// One landlord's whole flow: property and room, tenant, lease, invoices, payments, move-out.
import request from "supertest";
import { describe, expect, it } from "vitest";
import { today } from "../src/lib/dates.js";
import { app, isoDate, signUp } from "./helpers.js";

// A tiny valid PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("landlord rent flow", () => {
  it("runs from listing a room to settling the deposit", async () => {
    const { agent } = await signUp("LANDLORD", "Lena Landlord");

    // Property with a photo (multipart), then a room (JSON with numbers).
    const created = await agent
      .post("/api/landlord/properties")
      .field("name", "Riverside Condo")
      .field("type", "CONDO")
      .field("address", "12 River Rd")
      .field("city", "Phnom Penh")
      .attach("photos", PNG, { filename: "front.png", contentType: "image/png" })
      .expect(201);
    const propertyId = created.body.property.id as string;

    const room = await agent
      .post(`/api/landlord/properties/${propertyId}/rooms`)
      .send({ name: "Room A", rentPrice: 300, maxOccupants: 2, status: "AVAILABLE" })
      .expect(201);
    const roomId = room.body.room.id as string;
    expect(room.body.room.rentPrice).toBe("300");

    const detail = await agent.get(`/api/landlord/properties/${propertyId}`).expect(200);
    expect(detail.body.property.photos).toHaveLength(1);
    expect(detail.body.property.rooms[0]).toMatchObject({ id: roomId, _count: { leases: 0 } });
    const photo = await request(app).get(`/api/photos/${detail.body.property.photos[0].fileName}`).expect(200);
    expect(photo.headers["content-type"]).toBe("image/png");

    // The room shows up in public search.
    const search = await request(app).get("/api/rooms").query({ city: "Phnom", maxRent: 300 }).expect(200);
    expect(search.body.rooms.map((r: { id: string }) => r.id)).toContain(roomId);

    // Tenant and an active lease starting today, with a deposit.
    const tenant = await agent
      .post("/api/landlord/tenants")
      .send({ fullName: "Tom Tenant", phone: "012 345 678", email: "tom@example.com" })
      .expect(201);
    const tenantId = tenant.body.tenant.id as string;

    const start = today();
    const saved = await agent
      .post("/api/landlord/leases")
      .send({
        roomId,
        primaryTenantId: tenantId,
        startDate: isoDate(start),
        rentAmount: "",
        dueDay: Math.min(start.getUTCDate(), 28),
        depositAmount: 300,
        graceDays: 3,
        lateFeeType: "NONE",
        lateFeeValue: 0,
        intent: "activate",
      })
      .expect(201);
    expect(saved.body.activationError).toBeUndefined();
    expect(saved.body.lease).toMatchObject({ status: "ACTIVE", rentAmount: "300" });
    const leaseId = saved.body.lease.id as string;

    // Activation billed the deposit and the first month's rent.
    const lease = await agent.get(`/api/landlord/leases/${leaseId}`).expect(200);
    const kinds = lease.body.lease.invoices.map((i: { kind: string }) => i.kind).sort();
    expect(kinds).toEqual(["DEPOSIT", "RENT"]);
    expect(lease.body.lease.room.status).toBe("OCCUPIED");

    // A second lease on the same room can be drafted but not activated.
    const other = await agent.post("/api/landlord/tenants").send({ fullName: "Olga Other", phone: "099" }).expect(201);
    const clash = await agent
      .post("/api/landlord/leases")
      .send({
        roomId,
        primaryTenantId: other.body.tenant.id,
        startDate: isoDate(start),
        dueDay: 1,
        depositAmount: 0,
        graceDays: 3,
        lateFeeType: "NONE",
        lateFeeValue: 0,
        intent: "activate",
      })
      .expect(201);
    expect(clash.body.lease.status).toBe("DRAFT");
    expect(clash.body.activationError).toMatch(/already let to Tom Tenant/);
    await agent.delete(`/api/landlord/leases/${clash.body.lease.id}`).expect(204);

    // Paying more than owed clears both invoices and leaves credit.
    const options = await agent.get("/api/landlord/payments/options").query({ lease: leaseId }).expect(200);
    const owed = options.body.invoices.reduce(
      (s: number, i: { total: string; amountPaid: string }) => s + Number(i.total) - Number(i.amountPaid),
      0,
    );
    const paid = await agent
      .post("/api/landlord/payments")
      .send({ leaseId, payerTenantId: tenantId, amount: owed + 50, method: "CASH", paidOn: isoDate(start) })
      .expect(201);
    const paymentId = paid.body.payment.id as string;
    const afterPay = await agent.get(`/api/landlord/leases/${leaseId}`).expect(200);
    expect(afterPay.body.creditCents).toBe(5000);
    expect(afterPay.body.lease.invoices.every((i: { status: string }) => i.status === "PAID")).toBe(true);

    // Dashboard and tenant page agree.
    const dash = await agent.get("/api/landlord/dashboard").expect(200);
    expect(dash.body).toMatchObject({ rooms: 1, occupied: 1, unpaid: [] });
    const tenantPage = await agent.get(`/api/landlord/tenants/${tenantId}`).expect(200);
    expect(tenantPage.body.creditCents).toBe(5000);
    expect(tenantPage.body.payments).toHaveLength(1);

    // Reversing the payment puts the invoices back to unpaid.
    await agent.post(`/api/landlord/payments/${paymentId}/reverse`).send({ reason: "Bounced" }).expect(201);
    await agent.post(`/api/landlord/payments/${paymentId}/reverse`).send({ reason: "Again" }).expect(409);
    const reversed = await agent.get(`/api/landlord/invoices`).expect(200);
    expect(reversed.body.invoices.filter((i: { leaseId: string }) => i.leaseId === leaseId)).toHaveLength(2);

    // Pay again, then end the lease and refund the deposit.
    await agent
      .post("/api/landlord/payments")
      .send({ leaseId, amount: owed, method: "BANK", paidOn: isoDate(start) })
      .expect(201);
    await agent.post(`/api/landlord/leases/${leaseId}/end`).send({ endOn: isoDate(start) }).expect(200);
    const ended = await agent.get(`/api/landlord/leases/${leaseId}`).expect(200);
    expect(ended.body.lease.status).toBe("ENDED");
    expect(ended.body.lease.room.status).toBe("AVAILABLE");
    expect(ended.body.deposit.heldCents).toBe(30000);

    const tooMuch = await agent
      .post(`/api/landlord/leases/${leaseId}/deposit-transactions`)
      .send({ kind: "REFUND", amount: 301, date: isoDate(start) });
    expect(tooMuch.status).toBe(409);
    await agent
      .post(`/api/landlord/leases/${leaseId}/deposit-transactions`)
      .send({ kind: "REFUND", amount: 300, date: isoDate(start) })
      .expect(201);
    const settled = await agent.get(`/api/landlord/leases/${leaseId}`).expect(200);
    expect(settled.body.deposit.heldCents).toBe(0);

    // Rooms and tenants with lease history are kept.
    await agent.delete(`/api/landlord/rooms/${roomId}`).expect(409);
    await agent.delete(`/api/landlord/tenants/${tenantId}`).expect(409);
  });

  it("hides one landlord's records from another", async () => {
    const owner = await signUp("LANDLORD");
    const stranger = await signUp("LANDLORD");
    const property = await owner.agent
      .post("/api/landlord/properties")
      .send({ name: "Mine", type: "HOUSE", address: "1 Main St", city: "Siem Reap" })
      .expect(201);
    const id = property.body.property.id;
    await stranger.agent.get(`/api/landlord/properties/${id}`).expect(404);
    await stranger.agent
      .put(`/api/landlord/properties/${id}`)
      .send({ name: "Taken", type: "HOUSE", address: "x", city: "y" })
      .expect(404);
    await stranger.agent.delete(`/api/landlord/properties/${id}`).expect(404);
    await owner.agent.delete(`/api/landlord/properties/${id}`).expect(204);
  });

  it("validates input and rejects non-image uploads", async () => {
    const { agent } = await signUp("LANDLORD");
    const bad = await agent.post("/api/landlord/properties").send({ name: "", type: "CASTLE" });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.fieldErrors)).toEqual(expect.arrayContaining(["name", "type", "address", "city"]));

    const upload = await agent
      .post("/api/landlord/properties")
      .field("name", "P")
      .field("type", "HOUSE")
      .field("address", "A")
      .field("city", "C")
      .attach("photos", Buffer.from("hello"), { filename: "notes.txt", contentType: "text/plain" });
    expect(upload.status).toBe(400);
    expect(upload.body.fieldErrors.photos[0]).toMatch(/only JPEG, PNG or WebP/);
  });

  it("runs the billing job only with the cron secret", async () => {
    await request(app).post("/api/cron/billing").expect(401);
    await request(app).post("/api/cron/billing").set("Authorization", `Bearer ${process.env.CRON_SECRET}`).expect(200);
  });
});
