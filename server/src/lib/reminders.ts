// Invoice emails sent by the daily billing job: a reminder shortly before an invoice is due, and
// a notice once it is overdue. Each goes out at most once per invoice (the *SentAt columns).
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { addDays, formatPeriod, today } from "./dates.js";
import { invoiceDueSoon, invoiceOverdue } from "./emails.js";
import { sendMail, type Mail } from "./mail.js";
import { fromCents, toCents } from "./money.js";

export const REMINDER_DAYS_BEFORE = 3;
// Overdue notices only for invoices that fell due recently, so the first run after this feature
// ships doesn't email tenants about long-standing arrears.
export const OVERDUE_NOTICE_WITHIN_DAYS = 30;

const reminderInclude = {
  lease: {
    select: {
      graceDays: true,
      lateFeeType: true,
      lateFeeValue: true,
      room: { select: { name: true, property: { select: { name: true } } } },
      tenants: {
        select: { tenant: { select: { fullName: true, email: true, user: { select: { name: true, email: true } } } } },
      },
    },
  },
} satisfies Prisma.InvoiceInclude;
type ReminderInvoice = Prisma.InvoiceGetPayload<{ include: typeof reminderInclude }>;

function emailsFor(invoice: ReminderInvoice, kind: "due" | "overdue"): Mail[] {
  const { lease } = invoice;
  const lateFee =
    lease.lateFeeType === "NONE"
      ? null
      : lease.lateFeeType === "FLAT"
        ? `$${Number(lease.lateFeeValue).toFixed(2)}`
        : `${Number(lease.lateFeeValue)}% of the rent`;
  const info = {
    id: invoice.id,
    number: invoice.number,
    label:
      invoice.kind === "RENT" && invoice.period
        ? `Rent for ${formatPeriod(invoice.period)}`
        : invoice.kind === "DEPOSIT"
          ? "Security deposit"
          : "Invoice",
    roomLabel: `${lease.room.name}, ${lease.room.property.name}`,
    balance: fromCents(toCents(invoice.total.toFixed(2)) - toCents(invoice.amountPaid.toFixed(2))),
    dueDate: invoice.dueDate,
    graceDays: lease.graceDays,
    lateFee,
  };
  // Each tenant on the lease: their account's email if linked, else the one on their record.
  const seen = new Set<string>();
  const mails: Mail[] = [];
  for (const { tenant } of lease.tenants) {
    const person = tenant.user ?? (tenant.email ? { name: tenant.fullName, email: tenant.email } : null);
    if (!person || seen.has(person.email)) continue;
    seen.add(person.email);
    const hasAccount = Boolean(tenant.user);
    mails.push(kind === "due" ? invoiceDueSoon(person, info, hasAccount) : invoiceOverdue(person, info, hasAccount));
  }
  return mails;
}

// Claims each invoice (sets its timestamp only if still unset) before emailing, so two runs at
// once can't both send. Returns how many invoices were emailed about.
async function remind(kind: "due" | "overdue", where: Prisma.InvoiceWhereInput) {
  const field = kind === "due" ? "dueReminderSentAt" : "overdueNoticeSentAt";
  const invoices = await prisma.invoice.findMany({
    where: { ...where, lease: { status: "ACTIVE" }, [field]: null },
    include: reminderInclude,
  });
  let sent = 0;
  for (const invoice of invoices) {
    const claimed = await prisma.invoice.updateMany({
      where: { id: invoice.id, [field]: null },
      data: { [field]: new Date() },
    });
    if (claimed.count === 0) continue;
    await Promise.all(emailsFor(invoice, kind).map(sendMail));
    sent++;
  }
  return sent;
}

export async function sendInvoiceReminders(on = today()) {
  const dueSoon = await remind("due", {
    status: { in: ["OPEN", "PARTIAL"] },
    dueDate: { gte: on, lte: addDays(on, REMINDER_DAYS_BEFORE) },
  });
  const overdue = await remind("overdue", {
    status: "OVERDUE",
    dueDate: { gte: addDays(on, -OVERDUE_NOTICE_WITHIN_DAYS) },
  });
  return { dueSoon, overdue };
}
