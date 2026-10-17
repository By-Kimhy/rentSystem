// A tenant reports a payment; the landlord confirms it into a real payment or rejects it.
import request from "supertest";
import { describe, expect, it } from "vitest";
import { addDays, today } from "../src/lib/dates.js";
import { app, isoDate, signUp } from "./helpers.js";

// A landlord, a tenant account approved for a room, and an active lease with a deposit.
async function letRoom() {
  const landlord = await signUp("LANDLORD", "Lena Landlord");
  const property = await landlord.agent
    .post("/api/landlord/properties")
    .send({ name: "Lotus Flats", type: "APARTMENT", address: "3 Lotus Rd", city: "Kep" })
    .expect(201);
  const room = await landlord.agent
    .post(`/api/landlord/properties/${property.body.property.id}/rooms`)
    .send({ name: "Flat 2", rentPrice: 200, maxOccupants: 1, status: "AVAILABLE" })
    .expect(201);
  const roomId = room.body.room.id as string;
  const tenant = await signUp("TENANT", "Tia Tenant");
  const applied = await tenant.agent
    .post("/api/tenant/applications")
    .send({ roomId, phone: "012 345 678", moveInDate: isoDate(today()), occupants: 1 })
    .expect(201);
  const approved = await landlord.agent.post(`/api/landlord/applications/${applied.body.application.id}/approve`).expect(200);
  const tenantId = approved.body.application.tenant.id as string;
  const lease = await landlord.agent
    .post("/api/landlord/leases")
    .send({
      roomId,
      primaryTenantId: tenantId,
      startDate: isoDate(today()),
      dueDay: Math.min(today().getUTCDate(), 28),
      depositAmount: 100,
      graceDays: 3,
      lateFeeType: "NONE",
      lateFeeValue: 0,
      intent: "activate",
    })
    .expect(201);
  return { landlord, tenant, tenantId, leaseId: lease.body.lease.id as string };
}

describe("payment reports", () => {
  it("turns a confirmed report into a payment on the tenant's invoices", async () => {
    const { landlord, tenant, tenantId, leaseId } = await letRoom();
    const report = (body: Record<string, unknown>) => tenant.agent.post("/api/tenant/payment-reports").send(body);

    const future = await report({ leaseId, amount: 100, method: "BANK", paidOn: isoDate(addDays(today(), 1)) }).expect(400);
    expect(future.body.fieldErrors.paidOn).toBeDefined();
    await report({ leaseId, amount: 0, method: "BANK", paidOn: isoDate(today()) }).expect(400);

    const sent = await report({
      leaseId,
      amount: 300,
      method: "BANK",
      paidOn: isoDate(today()),
      reference: "ABA 991",
      note: "Deposit and first month",
    }).expect(201);
    const reportId = sent.body.report.id as string;
    expect(sent.body.report).toMatchObject({ status: "PENDING", amount: "300" });

    // Only the room's landlord sees and decides it.
    const stranger = await signUp("LANDLORD");
    expect((await stranger.agent.get("/api/landlord/payment-reports").expect(200)).body.reports).toEqual([]);
    await stranger.agent.post(`/api/landlord/payment-reports/${reportId}/confirm`).expect(404);

    const waiting = await landlord.agent.get("/api/landlord/payment-reports").expect(200);
    expect(waiting.body.reports).toHaveLength(1);
    expect(waiting.body.reports[0]).toMatchObject({
      id: reportId,
      reference: "ABA 991",
      reporter: { name: "Tia Tenant" },
      lease: { id: leaseId, room: { name: "Flat 2" } },
    });

    const confirmed = await landlord.agent.post(`/api/landlord/payment-reports/${reportId}/confirm`).expect(200);
    expect(confirmed.body.payment).toMatchObject({
      amount: "300",
      method: "BANK",
      payerTenantId: tenantId,
      reference: "ABA 991",
      notes: "Reported by tenant: Deposit and first month",
    });
    await landlord.agent.post(`/api/landlord/payment-reports/${reportId}/confirm`).expect(409);
    await landlord.agent.post(`/api/landlord/payment-reports/${reportId}/reject`).send({ reason: "x" }).expect(409);
    await tenant.agent.post(`/api/tenant/payment-reports/${reportId}/cancel`).expect(409);

    // The payment paid the deposit and the first month's rent.
    const home = await tenant.agent.get("/api/tenant/home").expect(200);
    expect(home.body.invoices.every((i: { status: string }) => i.status === "PAID")).toBe(true);
    expect(home.body.payments).toHaveLength(1);
    expect(home.body.paymentReports[0]).toMatchObject({ id: reportId, status: "CONFIRMED" });
    expect((await landlord.agent.get("/api/landlord/payment-reports").expect(200)).body.reports).toEqual([]);
  });

  it("lets the landlord reject and the tenant cancel, and keeps other accounts out", async () => {
    const { landlord, tenant, leaseId } = await letRoom();
    const send = () =>
      tenant.agent
        .post("/api/tenant/payment-reports")
        .send({ leaseId, amount: 50, method: "CASH", paidOn: isoDate(today()) })
        .expect(201)
        .then((r) => r.body.report.id as string);

    const first = await send();
    await landlord.agent.post(`/api/landlord/payment-reports/${first}/reject`).send({ reason: "" }).expect(400);
    await landlord.agent
      .post(`/api/landlord/payment-reports/${first}/reject`)
      .send({ reason: "Nothing arrived in the account." })
      .expect(204);

    const second = await send();
    const other = await signUp("TENANT");
    await other.agent.post(`/api/tenant/payment-reports/${second}/cancel`).expect(409);
    await other.agent
      .post("/api/tenant/payment-reports")
      .send({ leaseId, amount: 50, method: "CASH", paidOn: isoDate(today()) })
      .expect(404);
    await tenant.agent.post(`/api/tenant/payment-reports/${second}/cancel`).expect(204);

    const home = await tenant.agent.get("/api/tenant/home").expect(200);
    expect(home.body.payments).toEqual([]);
    expect(home.body.paymentReports.map((r: { status: string; rejectReason: string | null }) => [r.status, r.rejectReason])).toEqual([
      ["CANCELLED", null],
      ["REJECTED", "Nothing arrived in the account."],
    ]);
    const all = await landlord.agent.get("/api/landlord/payment-reports").query({ show: "all" }).expect(200);
    expect(all.body.reports).toHaveLength(2);
    await request(app).post("/api/tenant/payment-reports").send({}).expect(401);
  });
});
