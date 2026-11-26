// Email reminders: rent due soon, overdue, and lease ending; each sent once.
import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import { addDays, today } from "../src/lib/dates.js";
import { outbox } from "../src/lib/mail.js";
import { sendReminders } from "../src/lib/reminders.js";
import { app, isoDate, signUp } from "./helpers.js";

const mailTo = (email: string) => outbox.filter((m) => m.to === email);

async function setUp(opts: { tenantEmail: string | null; endDate?: Date }) {
  const landlord = await signUp("LANDLORD", "Rhea Landlord");
  const property = await landlord.agent
    .post("/api/landlord/properties")
    .send({ name: "Lotus Flats", type: "APARTMENT", address: "1 Lotus Rd", city: "Kampot" })
    .expect(201);
  const room = await landlord.agent
    .post(`/api/landlord/properties/${property.body.property.id}/rooms`)
    .send({ name: "Room 2", rentPrice: 150, maxOccupants: 1, status: "AVAILABLE" })
    .expect(201);
  const tenant = await landlord.agent
    .post("/api/landlord/tenants")
    .send({ fullName: "Tom Tenant", phone: "012 345 678", email: opts.tenantEmail ?? "" })
    .expect(201);
  const lease = await landlord.agent
    .post("/api/landlord/leases")
    .send({
      roomId: room.body.room.id,
      primaryTenantId: tenant.body.tenant.id,
      startDate: isoDate(today()),
      endDate: opts.endDate ? isoDate(opts.endDate) : "",
      // Due today, so the first rent invoice is due now.
      dueDay: Math.min(today().getUTCDate(), 28),
      depositAmount: 0,
      graceDays: 3,
      lateFeeType: "NONE",
      lateFeeValue: 0,
      intent: "activate",
    })
    .expect(201);
  return { landlord, leaseId: lease.body.lease.id as string };
}

describe("email reminders", () => {
  beforeEach(() => {
    outbox.length = 0;
  });

  it("reminds the tenant before rent is due, then when overdue, once each", async () => {
    const email = `tom-${randomUUID()}@test.local`;
    const { landlord, leaseId } = await setUp({ tenantEmail: email });

    await sendReminders();
    expect(mailTo(email)).toHaveLength(1);
    expect(mailTo(email)[0].subject).toMatch(/^Reminder: \$[\d.]+ due today$/);
    await sendReminders();
    expect(mailTo(email)).toHaveLength(1);

    // Ten days late with 3 grace days: overdue.
    await prisma.invoice.updateMany({ where: { leaseId, kind: "RENT" }, data: { dueDate: addDays(today(), -10) } });
    await sendReminders();
    await sendReminders();
    const overdue = mailTo(email).filter((m) => m.subject.startsWith("Overdue"));
    expect(overdue).toHaveLength(1);
    expect(overdue[0].text).toContain("10 days ago");

    // A week later the next overdue reminder goes out.
    await prisma.invoice.updateMany({ where: { leaseId, kind: "RENT" }, data: { dueDate: addDays(today(), -17) } });
    await sendReminders();
    expect(mailTo(email).filter((m) => m.subject.startsWith("Overdue"))).toHaveLength(2);

    // The landlord sees what was sent on the lease.
    const page = await landlord.agent.get(`/api/landlord/leases/${leaseId}`).expect(200);
    expect(page.body.lease.reminders.map((r: { kind: string }) => r.kind)).toEqual(["RENT_OVERDUE", "RENT_OVERDUE", "RENT_DUE"]);
  });

  it("tells the tenant and the landlord when a lease is ending", async () => {
    const email = `tom-${randomUUID()}@test.local`;
    const { landlord } = await setUp({ tenantEmail: email, endDate: addDays(today(), 20) });
    await sendReminders();
    await sendReminders();
    expect(mailTo(email).filter((m) => m.subject.startsWith("Your lease ends"))).toHaveLength(1);
    expect(mailTo(landlord.email).filter((m) => m.subject.startsWith("Lease ending"))).toHaveLength(1);
  });

  it("skips tenants with no email, and the cron endpoint needs the secret", async () => {
    const { leaseId } = await setUp({ tenantEmail: null });
    await request(app).post("/api/cron/reminders").expect(401);
    const run = await request(app)
      .post("/api/cron/reminders")
      .set("Authorization", `Bearer ${process.env.CRON_SECRET}`)
      .expect(200);
    expect(run.body.skipped).toBeGreaterThan(0);
    expect(await prisma.reminder.count({ where: { leaseId } })).toBe(0);
  });
});
