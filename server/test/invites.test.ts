// Invite links: a landlord links a tenant they added by hand to the tenant's own account.
import request from "supertest";
import { describe, expect, it } from "vitest";
import { today } from "../src/lib/dates.js";
import { prisma } from "../src/db.js";
import { app, isoDate, signUp } from "./helpers.js";

describe("tenant invites", () => {
  it("links a hand-added tenant to their account once, and shows them their lease", async () => {
    const landlord = await signUp("LANDLORD", "Lena Landlord");
    const property = await landlord.agent
      .post("/api/landlord/properties")
      .send({ name: "Banyan House", type: "HOUSE", address: "9 Banyan St", city: "Takeo" })
      .expect(201);
    const room = await landlord.agent
      .post(`/api/landlord/properties/${property.body.property.id}/rooms`)
      .send({ name: "Front room", rentPrice: 120, maxOccupants: 1, status: "AVAILABLE" })
      .expect(201);
    const added = await landlord.agent
      .post("/api/landlord/tenants")
      .send({ fullName: "Wendy Walk-in", phone: "099 888 777", notes: "Pays cash" })
      .expect(201);
    const tenantId = added.body.tenant.id as string;
    await landlord.agent
      .post("/api/landlord/leases")
      .send({
        roomId: room.body.room.id,
        primaryTenantId: tenantId,
        startDate: isoDate(today()),
        dueDay: Math.min(today().getUTCDate(), 28),
        depositAmount: 0,
        graceDays: 3,
        lateFeeType: "NONE",
        lateFeeValue: 0,
        intent: "activate",
      })
      .expect(201);

    // Only the tenant's landlord can make a link; a new link replaces the old one.
    const stranger = await signUp("LANDLORD");
    await stranger.agent.post(`/api/landlord/tenants/${tenantId}/invite`).expect(404);
    const first = (await landlord.agent.post(`/api/landlord/tenants/${tenantId}/invite`).expect(201)).body.token as string;
    const token = (await landlord.agent.post(`/api/landlord/tenants/${tenantId}/invite`).expect(201)).body.token as string;
    await request(app).get(`/api/invites/${first}`).expect(404);

    // The hash never leaves the API.
    const record = await landlord.agent.get(`/api/landlord/tenants/${tenantId}`).expect(200);
    expect(record.body.tenant).not.toHaveProperty("inviteTokenHash");
    expect(record.body.tenant.invitedAt).toBeTruthy();

    const preview = await request(app).get(`/api/invites/${token}`).expect(200);
    expect(preview.body.invite).toEqual({ tenantName: "Wendy Walk-in", landlordName: "Lena Landlord" });

    // Accepting needs a tenant account, works once, and links the record.
    await landlord.agent.post(`/api/tenant/invites/${token}/accept`).expect(403);
    const wendy = await signUp("TENANT", "Wendy W");
    await wendy.agent.post(`/api/tenant/invites/${token}/accept`).expect(204);
    const other = await signUp("TENANT");
    await other.agent.post(`/api/tenant/invites/${token}/accept`).expect(404);
    await request(app).get(`/api/invites/${token}`).expect(404);

    const home = await wendy.agent.get("/api/tenant/home").expect(200);
    expect(home.body.leases).toHaveLength(1);
    expect(home.body.leases[0].tenants[0].tenant.fullName).toBe("Wendy Walk-in");
    expect(JSON.stringify(home.body)).not.toContain("Pays cash");
    await landlord.agent.post(`/api/landlord/tenants/${tenantId}/invite`).expect(409);
  });

  it("refuses expired and revoked links, and a second record with the same landlord", async () => {
    const landlord = await signUp("LANDLORD");
    const mk = async (fullName: string) =>
      (await landlord.agent.post("/api/landlord/tenants").send({ fullName, phone: "1" }).expect(201)).body.tenant.id as string;
    const a = await mk("A"), b = await mk("B"), c = await mk("C");
    const tenant = await signUp("TENANT");

    const expired = (await landlord.agent.post(`/api/landlord/tenants/${a}/invite`).expect(201)).body.token as string;
    await prisma.tenant.update({ where: { id: a }, data: { invitedAt: new Date(Date.now() - 15 * 86_400_000) } });
    await tenant.agent.post(`/api/tenant/invites/${expired}/accept`).expect(404);

    const revoked = (await landlord.agent.post(`/api/landlord/tenants/${b}/invite`).expect(201)).body.token as string;
    await landlord.agent.delete(`/api/landlord/tenants/${b}/invite`).expect(204);
    await tenant.agent.post(`/api/tenant/invites/${revoked}/accept`).expect(404);

    const ok = (await landlord.agent.post(`/api/landlord/tenants/${c}/invite`).expect(201)).body.token as string;
    await tenant.agent.post(`/api/tenant/invites/${ok}/accept`).expect(204);
    const again = (await landlord.agent.post(`/api/landlord/tenants/${a}/invite`).expect(201)).body.token as string;
    await tenant.agent.post(`/api/tenant/invites/${again}/accept`).expect(409);
    await request(app).get("/api/invites/not-a-token").expect(404);
  });
});
