// Email reminders to tenants (and lease-end notices to landlords):
//   RENT_DUE      an unpaid invoice falls due within REMINDER_DUE_DAYS (default 3)
//   RENT_OVERDUE  an invoice turned overdue, then again every REMINDER_OVERDUE_EVERY_DAYS (default 7),
//                 at most REMINDER_OVERDUE_MAX times (default 3)
//   LEASE_ENDING  a fixed-term lease that hasn't been renewed ends in 30 days, and again at 7 days
// Each reminder is recorded with a key naming the invoice or lease and the stage before it is sent,
// so the job can run every hour, or from several servers, and still send each one once.
import { Prisma, type ReminderKind } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { syncBilling } from "./billing.js";
import { addDays, daysBetween, today } from "./dates.js";
import { sendEmail } from "./mail.js";
import { fromCents, toCents } from "./money.js";

const intEnv = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
};

export const reminderSettings = () => ({
  dueDays: intEnv("REMINDER_DUE_DAYS", 3),
  overdueEveryDays: Math.max(1, intEnv("REMINDER_OVERDUE_EVERY_DAYS", 7)),
  overdueMax: intEnv("REMINDER_OVERDUE_MAX", 3),
});

// Days before the end of a fixed-term lease when a notice goes out, largest first.
export const LEASE_ENDING_STAGES = [30, 7];

export type ReminderRun = { sent: number; skipped: number; failed: number };

const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(fromCents(cents)));
const longDate = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(d);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const leaseInclude = {
  room: { include: { property: { include: { landlord: { select: { name: true, email: true } } } } } },
  tenants: {
    where: { isPrimary: true },
    include: { tenant: { select: { fullName: true, email: true, user: { select: { email: true } } } } },
  },
} satisfies Prisma.LeaseInclude;
type ReminderLease = Prisma.LeaseGetPayload<{ include: typeof leaseInclude }>;

// Where a lease's reminders go: the primary tenant's email on file, else their account's email.
export function tenantEmailOf(lease: ReminderLease) {
  const primary = lease.tenants[0]?.tenant;
  return { name: primary?.fullName ?? "there", email: primary?.email || primary?.user?.email || null, hasAccount: !!primary?.user };
}

const place = (lease: ReminderLease) => `${lease.room.name}, ${lease.room.property.name}`;

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

type Outgoing = {
  key: string;
  kind: ReminderKind;
  leaseId: string;
  invoiceId?: string;
  to: string;
  subject: string;
  text: string;
};

// Records the reminder, then sends it. A failed send removes the record so the next run retries.
async function deliver(r: Outgoing, run: ReminderRun) {
  let record;
  try {
    record = await prisma.reminder.create({
      data: { key: r.key, kind: r.kind, leaseId: r.leaseId, invoiceId: r.invoiceId, recipient: r.to, subject: r.subject },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return; // already sent
    throw e;
  }
  try {
    await sendEmail({ to: r.to, subject: r.subject, text: r.text });
    run.sent++;
  } catch (e) {
    console.error(`Could not send reminder ${r.key} to ${r.to}:`, e);
    await prisma.reminder.delete({ where: { id: record.id } }).catch(() => undefined);
    run.failed++;
  }
}

const signOff = (lease: ReminderLease) => {
  const landlord = lease.room.property.landlord;
  return `Questions? Contact your landlord, ${landlord.name}${landlord.email ? ` (${landlord.email})` : ""}.`;
};

export async function sendRentReminders(on: Date, run: ReminderRun) {
  const { dueDays, overdueEveryDays, overdueMax } = reminderSettings();
  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { status: { in: ["OPEN", "PARTIAL"] }, dueDate: { gte: on, lte: addDays(on, dueDays) } },
        ...(overdueMax > 0 ? [{ status: "OVERDUE" as const }] : []),
      ],
      lease: { status: { not: "DRAFT" } },
    },
    include: { lease: { include: leaseInclude } },
    orderBy: { dueDate: "asc" },
  });

  for (const invoice of invoices) {
    const lease = invoice.lease;
    const tenant = tenantEmailOf(lease);
    if (!tenant.email) {
      run.skipped++;
      continue;
    }
    const left = toCents(invoice.total) - toCents(invoice.amountPaid);
    if (left <= 0) continue;
    const link = tenant.hasAccount ? `\n\nSee the invoice and report a payment: ${config.appUrl()}/tenant/invoices/${invoice.id}` : "";
    const what = `invoice #${invoice.number} for ${place(lease)}`;

    if (invoice.status === "OVERDUE") {
      // The first day it counts as overdue, then every overdueEveryDays after.
      const overdueFrom = addDays(invoice.dueDate, lease.graceDays + 1);
      const stage = Math.floor(Math.max(0, daysBetween(overdueFrom, on)) / overdueEveryDays);
      if (stage >= overdueMax) continue;
      const late = daysBetween(invoice.dueDate, on);
      await deliver(
        {
          key: `overdue:${invoice.id}:${stage}`,
          kind: "RENT_OVERDUE",
          leaseId: lease.id,
          invoiceId: invoice.id,
          to: tenant.email,
          subject: `Overdue: ${usd(left)} was due on ${longDate(invoice.dueDate)}`,
          text: `Hi ${tenant.name},\n\nPayment for ${what} is overdue. ${usd(left)} was due on ${longDate(invoice.dueDate)}, ${plural(late, "day")} ago. Please pay as soon as you can${lease.lateFeeType !== "NONE" && !invoice.lateFeeApplied ? " to avoid a late fee" : ""}.${link}\n\n${signOff(lease)}`,
        },
        run,
      );
    } else {
      const inDays = daysBetween(on, invoice.dueDate);
      const when = inDays === 0 ? "today" : inDays === 1 ? "tomorrow" : `in ${plural(inDays, "day")}`;
      await deliver(
        {
          key: `due:${invoice.id}`,
          kind: "RENT_DUE",
          leaseId: lease.id,
          invoiceId: invoice.id,
          to: tenant.email,
          subject: `Reminder: ${usd(left)} due ${when === "today" ? "today" : `on ${longDate(invoice.dueDate)}`}`,
          text: `Hi ${tenant.name},\n\nThis is a reminder that ${usd(left)} for ${what} is due ${when} (${longDate(invoice.dueDate)}).${link}\n\nAlready paid? Thank you, and please ignore this email.\n\n${signOff(lease)}`,
        },
        run,
      );
    }
  }
}

export async function sendLeaseEndingReminders(on: Date, run: ReminderRun) {
  const leases = await prisma.lease.findMany({
    where: {
      status: "ACTIVE",
      endDate: { gte: on, lte: addDays(on, LEASE_ENDING_STAGES[0]) },
      renewedBy: { is: null },
    },
    include: leaseInclude,
  });
  for (const lease of leases) {
    const end = lease.endDate!;
    const daysLeft = daysBetween(on, end);
    // The smallest stage the lease has reached, e.g. 7 once a week or less is left.
    const stage = [...LEASE_ENDING_STAGES].reverse().find((s) => daysLeft <= s);
    if (stage === undefined) continue;
    const left = daysLeft === 0 ? "today" : `in ${plural(daysLeft, "day")}`;

    const tenant = tenantEmailOf(lease);
    if (tenant.email) {
      await deliver(
        {
          key: `ending:${lease.id}:${stage}`,
          kind: "LEASE_ENDING",
          leaseId: lease.id,
          to: tenant.email,
          subject: `Your lease ends on ${longDate(end)}`,
          text: `Hi ${tenant.name},\n\nYour lease for ${place(lease)} ends ${left}, on ${longDate(end)}. If you'd like to stay longer, talk to your landlord about renewing. If you're moving out, please agree a move-out day and the return of your deposit with them.\n\n${signOff(lease)}`,
        },
        run,
      );
    } else {
      run.skipped++;
    }

    const landlord = lease.room.property.landlord;
    await deliver(
      {
        key: `ending-landlord:${lease.id}:${stage}`,
        kind: "LEASE_ENDING",
        leaseId: lease.id,
        to: landlord.email,
        subject: `Lease ending: ${place(lease)} on ${longDate(end)}`,
        text: `Hi ${landlord.name},\n\nThe lease for ${place(lease)} (${tenant.name}) ends ${left}, on ${longDate(end)}, and hasn't been renewed. Renew it, or plan the move-out and deposit: ${config.appUrl()}/landlord/leases/${lease.id}`,
      },
      run,
    );
  }
}

/** Brings billing up to date, then sends every reminder that is due. Safe to run any number of times. */
export async function sendReminders(on = today()): Promise<ReminderRun> {
  await syncBilling();
  const run: ReminderRun = { sent: 0, skipped: 0, failed: 0 };
  await sendRentReminders(on, run);
  await sendLeaseEndingReminders(on, run);
  return run;
}
