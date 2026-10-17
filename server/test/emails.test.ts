// Emails sent for applications, payment reports and invites (collected in sentMail under test).
import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import { addDays, today } from "../src/lib/dates.js";
import { sentMail } from "../src/lib/mail.js";
import { app, isoDate, signUp } from "./helpers.js";

const mailTo = (email: string) => sentMail.filter((m) => m.to === email);

async function listedRoom(maxOccupants = 1) {
  const landlord = await signUp("LANDLORD", "Lena Landlord");
  const property = await landlord.agent
    .post("/api/landlord/properties")
    .send({ name: "Mango House", type: "HOUSE", address: "4 Mango St", city: "Kampot" })
    .expect(201);
  const room = await landlord.agent
    .post(`/api/landlord/properties/${property.body.property.id}/rooms`)
    .send({ name: "Room 7", rentPrice: 150, maxOccupants, status: "AVAILABLE" })
    .expect(201);
  return { landlord, roomId: room.body.room.id as string };
}

const apply = (agent: Awaited<ReturnType<typeof signUp>>["agent"], roomId: string) =>
  agent
    .post("/api/tenant/applications")
    .send({ roomId, phone: "012 000 000", moveInDate: isoDate(today()), occupants: 1, message: "Hello!" })
    .expect(201)
    .then((r) => r.body.application.id as string);

const activateLease = (agent: Awaited<ReturnType<typeof signUp>>["agent"], roomId: string, tenantId: string) =>
  agent
    .post("/api/landlord/leases")
    .send({
      roomId,
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

describe("email notifications", () => {
  it("tells landlords about applications and applicants about decisions, including rooms that get let", async () => {
    const { landlord, roomId } = await listedRoom();
    const tia = await signUp("TENANT", "Tia Tenant");
    const sam = await signUp("TENANT", "Sam Second");
    const dee = await signUp("TENANT", "Dee Declined");

    const tiaApp = await apply(tia.agent, roomId);
    const [received] = mailTo(landlord.email);
    expect(received.subject).toBe("New application for Room 7, Mango House");
    expect(received.text).toContain("Tia Tenant applied for Room 7, Mango House");
    expect(received.text).toContain("Hello!");
    expect(received.text).toContain(`/landlord/applications/${tiaApp}`);

    const deeApp = await apply(dee.agent, roomId);
    await landlord.agent.post(`/api/landlord/applications/${deeApp}/reject`).expect(200);
    expect(mailTo(dee.email).map((m) => m.subject)).toEqual(["Update on your application for Room 7, Mango House"]);

    await apply(sam.agent, roomId);
    const approved = await landlord.agent.post(`/api/landlord/applications/${tiaApp}/approve`).expect(200);
    expect(mailTo(tia.email).map((m) => m.subject)).toEqual(["Your application for Room 7, Mango House was approved"]);
    expect(mailTo(landlord.email)).toHaveLength(3);

    // Activating Tia's lease declines Sam, and says why.
    await activateLease(landlord.agent, roomId, approved.body.application.tenant.id);
    const [samMail] = mailTo(sam.email);
    expect(samMail.subject).toBe("Update on your application for Room 7, Mango House");
    expect(samMail.text).toContain("This room has been let to another tenant.");
    expect(mailTo(tia.email)).toHaveLength(1);
  });

  it("covers payment reports both ways and emailed invite links", async () => {
    const { landlord, roomId } = await listedRoom();
    const tia = await signUp("TENANT", "Tia Tenant");
    const appId = await apply(tia.agent, roomId);
    const approved = await landlord.agent.post(`/api/landlord/applications/${appId}/approve`).expect(200);
    const lease = await activateLease(landlord.agent, roomId, approved.body.application.tenant.id);
    const leaseId = lease.body.lease.id as string;
    const before = mailTo(landlord.email).length;

    const report = (amount: number) =>
      tia.agent
        .post("/api/tenant/payment-reports")
        .send({ leaseId, amount, method: "BANK", paidOn: isoDate(today()), reference: "ABA 1" })
        .expect(201)
        .then((r) => r.body.report.id as string);
    const first = await report(150);
    const reported = mailTo(landlord.email).slice(before);
    expect(reported.map((m) => m.subject)).toEqual(["Tia Tenant reported a payment of $150.00"]);
    expect(reported[0].text).toContain("reference ABA 1");

    await landlord.agent.post(`/api/landlord/payment-reports/${first}/confirm`).send({ amount: "140" }).expect(200);
    const second = await report(20);
    await landlord.agent.post(`/api/landlord/payment-reports/${second}/reject`).send({ reason: "Nothing arrived." }).expect(204);
    const [confirmed, rejected] = mailTo(tia.email).slice(-2);
    expect(confirmed.subject).toBe("Your landlord confirmed your payment");
    expect(confirmed.text).toContain("They recorded $140.00 as received.");
    expect(rejected.subject).toBe("Your landlord could not confirm your payment");
    expect(rejected.text).toContain("Their reason: Nothing arrived.");

    // Invite links: emailed only when asked, and only with an address on the record.
    const noEmail = await landlord.agent.post("/api/landlord/tenants").send({ fullName: "No Mail", phone: "1" }).expect(201);
    await landlord.agent.post(`/api/landlord/tenants/${noEmail.body.tenant.id}/invite`).send({ email: true }).expect(400);
    const address = `wendy-${Date.now()}@example.com`;
    const wendy = await landlord.agent
      .post("/api/landlord/tenants")
      .send({ fullName: "Wendy Walk-in", phone: "1", email: address })
      .expect(201);
    await landlord.agent.post(`/api/landlord/tenants/${wendy.body.tenant.id}/invite`).expect(201);
    expect(mailTo(address)).toHaveLength(0);
    const sent = await landlord.agent.post(`/api/landlord/tenants/${wendy.body.tenant.id}/invite`).send({ email: true }).expect(201);
    const [invite] = mailTo(address);
    expect(invite.subject).toBe("Lena Landlord invited you to RentSystem");
    expect(invite.text).toContain(`/invite/${sent.body.token}`);
  });
});

describe("invoice reminder emails", () => {
  it("reminds once before the due date and sends one overdue notice", async () => {
    const { landlord, roomId } = await listedRoom(2);
    const tia = await signUp("TENANT", "Tia Tenant");
    const appId = await apply(tia.agent, roomId);
    const approved = await landlord.agent.post(`/api/landlord/applications/${appId}/approve`).expect(200);
    // A walk-in co-tenant with only an email on their record also gets the emails (without links).
    const coEmail = `co-${Date.now()}@example.com`;
    const co = await landlord.agent
      .post("/api/landlord/tenants")
      .send({ fullName: "Cara Cotenant", phone: "1", email: coEmail })
      .expect(201);
    const lease = await landlord.agent
      .post("/api/landlord/leases")
      .send({
        roomId,
        primaryTenantId: approved.body.application.tenant.id,
        otherTenantIds: [co.body.tenant.id],
        startDate: isoDate(today()),
        dueDay: Math.min(today().getUTCDate(), 28),
        depositAmount: 300,
        graceDays: 3,
        lateFeeType: "FLAT",
        lateFeeValue: 10,
        intent: "activate",
      })
      .expect(201);
    const leaseId = lease.body.lease.id as string;
    const cron = () =>
      request(app).post("/api/cron/billing").set("Authorization", `Bearer ${process.env.CRON_SECRET}`).expect(200);

    // The deposit is due today: one reminder each, with a link only for the account holder.
    await cron();
    const deposit = mailTo(tia.email).find((m) => m.subject.startsWith("Security deposit is due"));
    expect(deposit?.text).toContain("$300.00 is left to pay");
    expect(deposit?.text).toContain("a late fee of $10.00 applies");
    expect(deposit?.text).toContain("/tenant/invoices/");
    const coDeposit = mailTo(coEmail).find((m) => m.subject.startsWith("Security deposit is due"));
    expect(coDeposit?.text).not.toContain("/tenant/invoices/");
    const count = mailTo(tia.email).length;
    await cron();
    expect(mailTo(tia.email)).toHaveLength(count);

    // Push the deposit's due date back past the grace days: one overdue notice.
    await prisma.invoice.updateMany({
      where: { leaseId, kind: "DEPOSIT" },
      data: { dueDate: addDays(today(), -10), issueDate: addDays(today(), -12) },
    });
    await cron();
    await cron();
    const overdue = mailTo(tia.email).filter((m) => m.subject === "Security deposit is overdue");
    expect(overdue).toHaveLength(1);
    expect(overdue[0].text).toContain("is still unpaid");
  });
});
