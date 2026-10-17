// A tenant's own view of their lease, invoices and payments.
import request from "supertest";
import { describe, expect, it } from "vitest";
import { today } from "../src/lib/dates.js";
import { app, isoDate, signUp } from "./helpers.js";

describe("tenant home", () => {
  it("shows an approved applicant their lease, invoices and payments, and nothing private", async () => {
    const landlord = await signUp("LANDLORD", "Lena Landlord");
    const property = await landlord.agent
      .post("/api/landlord/properties")
      .send({ name: "Palm Court", type: "APARTMENT", address: "8 Palm St", city: "Battambang" })
      .expect(201);
    const room = await landlord.agent
      .post(`/api/landlord/properties/${property.body.property.id}/rooms`)
      .send({ name: "Room 5", rentPrice: 150, maxOccupants: 1, status: "AVAILABLE" })
      .expect(201);
    const roomId = room.body.room.id as string;

    const tenant = await signUp("TENANT", "Tia Tenant");
    const empty = await tenant.agent.get("/api/tenant/home").expect(200);
    expect(empty.body).toEqual({ leases: [], invoices: [], payments: [] });

    const start = today();
    const applied = await tenant.agent
      .post("/api/tenant/applications")
      .send({ roomId, phone: "012 345 678", moveInDate: isoDate(start), occupants: 1 })
      .expect(201);
    const approved = await landlord.agent
      .post(`/api/landlord/applications/${applied.body.application.id}/approve`)
      .expect(200);
    const tenantId = approved.body.application.tenant.id as string;
    await landlord.agent
      .put(`/api/landlord/tenants/${tenantId}`)
      .send({ fullName: "Tia Tenant", phone: "012 345 678", idDocNumber: "N-123", notes: "Landlord-only note" })
      .expect(200);

    const lease = await landlord.agent
      .post("/api/landlord/leases")
      .send({
        roomId,
        primaryTenantId: tenantId,
        startDate: isoDate(start),
        dueDay: Math.min(start.getUTCDate(), 28),
        depositAmount: 150,
        graceDays: 3,
        lateFeeType: "FLAT",
        lateFeeValue: 10,
        notes: "Private lease note",
        intent: "activate",
      })
      .expect(201);
    const leaseId = lease.body.lease.id as string;
    await landlord.agent
      .post("/api/landlord/payments")
      .send({ leaseId, payerTenantId: tenantId, amount: 150, method: "BANK", paidOn: isoDate(start), notes: "Private" })
      .expect(201);

    const home = await tenant.agent.get("/api/tenant/home").expect(200);
    expect(home.body.leases).toHaveLength(1);
    expect(home.body.leases[0]).toMatchObject({
      id: leaseId,
      status: "ACTIVE",
      rentAmount: "150",
      lateFeeType: "FLAT",
      room: { name: "Room 5", property: { name: "Palm Court", landlord: { name: "Lena Landlord" } } },
      tenants: [{ isPrimary: true, tenant: { fullName: "Tia Tenant" } }],
      creditCents: 0,
    });
    expect(home.body.invoices.map((i: { kind: string }) => i.kind).sort()).toEqual(["DEPOSIT", "RENT"]);
    expect(home.body.payments).toHaveLength(1);
    expect(home.body.payments[0]).toMatchObject({ amount: "150", payer: { fullName: "Tia Tenant" } });

    // Nothing the landlord keeps to themselves.
    const body = JSON.stringify(home.body);
    for (const secret of ["Private lease note", "Landlord-only note", "N-123", "Private", "receivedBy", "landlordId"]) {
      expect(body).not.toContain(secret);
    }

    const invoiceId = home.body.invoices[0].id as string;
    const invoice = await tenant.agent.get(`/api/tenant/invoices/${invoiceId}`).expect(200);
    expect(invoice.body.invoice.lease.room.property.landlord.email).toBe(landlord.email);
    expect(JSON.stringify(invoice.body)).not.toContain("N-123");

    // Other accounts see none of it.
    const stranger = await signUp("TENANT");
    expect((await stranger.agent.get("/api/tenant/home").expect(200)).body.leases).toEqual([]);
    await stranger.agent.get(`/api/tenant/invoices/${invoiceId}`).expect(404);
    await landlord.agent.get("/api/tenant/home").expect(403);
    await request(app).get("/api/tenant/home").expect(401);
  });
});
