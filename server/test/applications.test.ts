// Rental applications: a tenant applies for a listed room, the landlord decides.
import request from "supertest";
import { describe, expect, it } from "vitest";
import { addDays, today } from "../src/lib/dates.js";
import { app, isoDate, signUp } from "./helpers.js";

async function listedRoom(maxOccupants = 2) {
  const landlord = await signUp("LANDLORD", "Lena Landlord");
  const property = await landlord.agent
    .post("/api/landlord/properties")
    .send({ name: "Hill House", type: "HOUSE", address: "1 Hill Rd", city: "Kampot" })
    .expect(201);
  const room = await landlord.agent
    .post(`/api/landlord/properties/${property.body.property.id}/rooms`)
    .send({ name: "Room 1", rentPrice: 200, maxOccupants, status: "AVAILABLE" })
    .expect(201);
  return { landlord, roomId: room.body.room.id as string };
}

const nextWeek = () => isoDate(addDays(today(), 7));

describe("rental applications", () => {
  it("runs from applying to an approved tenant record", async () => {
    const { landlord, roomId } = await listedRoom();
    const tenant = await signUp("TENANT", "Tia Tenant");

    // Rules checked when applying.
    const tooMany = await tenant.agent
      .post("/api/tenant/applications")
      .send({ roomId, phone: "012 111 222", moveInDate: nextWeek(), occupants: 3 })
      .expect(400);
    expect(tooMany.body.fieldErrors.occupants).toEqual(["This room fits up to 2 people."]);
    const past = await tenant.agent
      .post("/api/tenant/applications")
      .send({ roomId, phone: "012 111 222", moveInDate: isoDate(addDays(today(), -1)), occupants: 1 })
      .expect(400);
    expect(past.body.fieldErrors.moveInDate).toBeDefined();

    const applied = await tenant.agent
      .post("/api/tenant/applications")
      .send({ roomId, phone: "012 111 222", moveInDate: nextWeek(), occupants: 2, message: "Quiet student." })
      .expect(201);
    const id = applied.body.application.id as string;
    expect(applied.body.application).toMatchObject({ status: "PENDING", room: { id: roomId } });

    await tenant.agent
      .post("/api/tenant/applications")
      .send({ roomId, phone: "012 111 222", moveInDate: nextWeek(), occupants: 1 })
      .expect(409);

    // Only tenants apply; only the room's landlord sees and decides.
    await landlord.agent.post("/api/tenant/applications").send({ roomId }).expect(403);
    const stranger = await signUp("LANDLORD");
    await stranger.agent.get(`/api/landlord/applications/${id}`).expect(404);
    await stranger.agent.post(`/api/landlord/applications/${id}/approve`).expect(404);
    expect((await stranger.agent.get("/api/landlord/applications").expect(200)).body.applications).toHaveLength(0);

    const pending = await landlord.agent.get("/api/landlord/applications").expect(200);
    expect(pending.body.applications).toHaveLength(1);
    expect(pending.body.applications[0]).toMatchObject({
      id,
      occupants: 2,
      message: "Quiet student.",
      applicant: { name: "Tia Tenant", email: tenant.email },
    });

    // Approving creates the landlord's tenant record, linked to the applicant's account.
    const approved = await landlord.agent.post(`/api/landlord/applications/${id}/approve`).expect(200);
    expect(approved.body.application).toMatchObject({ status: "APPROVED", tenant: { fullName: "Tia Tenant" } });
    const tenantId = approved.body.application.tenant.id as string;
    const record = await landlord.agent.get(`/api/landlord/tenants/${tenantId}`).expect(200);
    expect(record.body.tenant).toMatchObject({ phone: "012 111 222", email: tenant.email, userId: tenant.user.id });

    await landlord.agent.post(`/api/landlord/applications/${id}/reject`).expect(409);
    await tenant.agent.post(`/api/tenant/applications/${id}/withdraw`).expect(409);
    expect((await landlord.agent.get("/api/landlord/applications").expect(200)).body.applications).toHaveLength(0);

    // A second approved application from the same person reuses their tenant record.
    const again = await tenant.agent
      .post("/api/tenant/applications")
      .send({ roomId, phone: "099 999 999", moveInDate: nextWeek(), occupants: 1 })
      .expect(201);
    const second = await landlord.agent.post(`/api/landlord/applications/${again.body.application.id}/approve`).expect(200);
    expect(second.body.application.tenant.id).toBe(tenantId);

    const mine = await tenant.agent.get("/api/tenant/applications").expect(200);
    expect(mine.body.applications.map((a: { status: string }) => a.status)).toEqual(["APPROVED", "APPROVED"]);
    expect(mine.body.applications[0]).not.toHaveProperty("applicant");
  });

  it("lets the applicant withdraw and the landlord reject", async () => {
    const { landlord, roomId } = await listedRoom(1);
    const tenant = await signUp("TENANT");
    const apply = () =>
      tenant.agent
        .post("/api/tenant/applications")
        .send({ roomId, phone: "012 000 000", moveInDate: nextWeek(), occupants: 1 })
        .expect(201)
        .then((r) => r.body.application.id as string);

    const first = await apply();
    const other = await signUp("TENANT");
    await other.agent.post(`/api/tenant/applications/${first}/withdraw`).expect(409);
    await tenant.agent.post(`/api/tenant/applications/${first}/withdraw`).expect(204);
    await landlord.agent.post(`/api/landlord/applications/${first}/approve`).expect(409);

    const second = await apply();
    const rejected = await landlord.agent.post(`/api/landlord/applications/${second}/reject`).expect(200);
    expect(rejected.body.application.status).toBe("REJECTED");
    expect(rejected.body.application.tenant).toBeNull();

    const all = await landlord.agent.get("/api/landlord/applications").query({ show: "all" }).expect(200);
    expect(all.body.applications.map((a: { status: string }) => a.status)).toEqual(["REJECTED", "WITHDRAWN"]);
  });

  it("closes the room's other pending applications when a lease is activated", async () => {
    const { landlord, roomId } = await listedRoom();
    const apply = async (moveInDate: string) => {
      const t = await signUp("TENANT");
      const res = await t.agent
        .post("/api/tenant/applications")
        .send({ roomId, phone: "012 000 000", moveInDate, occupants: 1 })
        .expect(201);
      return { ...t, id: res.body.application.id as string };
    };
    const winner = await apply(nextWeek());
    const other = await apply(nextWeek());
    const later = await apply(isoDate(addDays(today(), 400)));

    // The winner's first application is approved, which links their account to a tenant record.
    // A second application from them is still pending when the landlord activates a one-year lease.
    const approved = await landlord.agent.post(`/api/landlord/applications/${winner.id}/approve`).expect(200);
    const again = await winner.agent
      .post("/api/tenant/applications")
      .send({ roomId, phone: "012 000 000", moveInDate: nextWeek(), occupants: 1 })
      .expect(201);
    await landlord.agent
      .post("/api/landlord/leases")
      .send({
        roomId,
        primaryTenantId: approved.body.application.tenant.id,
        startDate: nextWeek(),
        endDate: isoDate(addDays(today(), 7 + 364)),
        dueDay: 1,
        depositAmount: 0,
        graceDays: 3,
        lateFeeType: "NONE",
        lateFeeValue: 0,
        intent: "activate",
      })
      .expect(201);

    const status = async (t: typeof winner, id: string) =>
      (await t.agent.get("/api/tenant/applications").expect(200)).body.applications.find(
        (a: { id: string }) => a.id === id,
      );
    expect(await status(winner, again.body.application.id)).toMatchObject({ status: "APPROVED", declineReason: null });
    expect(await status(other, other.id)).toMatchObject({
      status: "REJECTED",
      declineReason: "This room has been let to another tenant.",
    });
    // Moving in after the lease ends: still open.
    expect(await status(later, later.id)).toMatchObject({ status: "PENDING" });
    const pending = await landlord.agent.get("/api/landlord/applications").expect(200);
    expect(pending.body.applications.map((a: { id: string }) => a.id)).toEqual([later.id]);
  });

  it("refuses applications for rooms that are not available", async () => {
    const { landlord, roomId } = await listedRoom();
    await landlord.agent
      .put(`/api/landlord/rooms/${roomId}`)
      .send({ name: "Room 1", rentPrice: 200, maxOccupants: 2, status: "MAINTENANCE" })
      .expect(200);
    const tenant = await signUp("TENANT");
    await tenant.agent
      .post("/api/tenant/applications")
      .send({ roomId, phone: "012 000 000", moveInDate: nextWeek(), occupants: 1 })
      .expect(409);
    await request(app).get("/api/tenant/applications").expect(401);
  });
});
