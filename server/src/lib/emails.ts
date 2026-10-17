// The text of every email the app sends, in one place. Plain text, with a link back to the page
// where the reader can act.
import { config } from "../config.js";
import { toISODate } from "./dates.js";
import type { Mail } from "./mail.js";

type Person = { name: string; email: string };
type Amount = { toString(): string } | number | string;

const usd = (amount: Amount) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amount.toString()));
const link = (path: string) => `${config.appUrl()}${path}`;
const sign = "\n\n— RentSystem";

export function applicationReceived(
  landlord: Person,
  a: { id: string; applicantName: string; roomLabel: string; moveInDate: Date; occupants: number; message: string | null },
): Mail {
  return {
    to: landlord.email,
    subject: `New application for ${a.roomLabel}`,
    text:
      `Hi ${landlord.name},\n\n${a.applicantName} applied for ${a.roomLabel}, moving in on ${toISODate(a.moveInDate)} ` +
      `(${a.occupants === 1 ? "1 person" : `${a.occupants} people`}).` +
      (a.message ? `\n\nTheir message:\n${a.message}` : "") +
      `\n\nReview it: ${link(`/landlord/applications/${a.id}`)}${sign}`,
  };
}

export function applicationDecided(applicant: Person, roomLabel: string, approved: boolean, reason?: string | null): Mail {
  return {
    to: applicant.email,
    subject: approved ? `Your application for ${roomLabel} was approved` : `Update on your application for ${roomLabel}`,
    text: approved
      ? `Hi ${applicant.name},\n\nGood news: your application for ${roomLabel} was approved. Your landlord will set up ` +
        `the lease with you, and it will appear on your dashboard: ${link("/tenant")}${sign}`
      : `Hi ${applicant.name},\n\nYour application for ${roomLabel} was not accepted.` +
        (reason ? ` ${reason}` : "") +
        `\n\nOther rooms are listed here: ${link("/rooms")}${sign}`,
  };
}

export function paymentReported(
  landlord: Person,
  r: { tenantName: string; roomLabel: string; amount: Amount; paidOn: Date; reference: string | null },
): Mail {
  return {
    to: landlord.email,
    subject: `${r.tenantName} reported a payment of ${usd(r.amount)}`,
    text:
      `Hi ${landlord.name},\n\n${r.tenantName} (${r.roomLabel}) says they paid ${usd(r.amount)} on ${toISODate(r.paidOn)}` +
      (r.reference ? `, reference ${r.reference}` : "") +
      `.\n\nCheck it against what you received, then confirm or reject it: ${link("/landlord/payments")}${sign}`,
  };
}

export function paymentReportDecided(
  tenant: Person,
  r: { amount: Amount; paidOn: Date; confirmed: boolean; recordedAmount?: Amount; reason?: string | null },
): Mail {
  const what = `your payment of ${usd(r.amount)} on ${toISODate(r.paidOn)}`;
  const corrected = r.recordedAmount !== undefined && usd(r.recordedAmount) !== usd(r.amount);
  return {
    to: tenant.email,
    subject: r.confirmed ? "Your landlord confirmed your payment" : "Your landlord could not confirm your payment",
    text: r.confirmed
      ? `Hi ${tenant.name},\n\nYour landlord confirmed ${what}.` +
        (corrected ? ` They recorded ${usd(r.recordedAmount!)} as received.` : "") +
        `\n\nYour balance: ${link("/tenant")}${sign}`
      : `Hi ${tenant.name},\n\nYour landlord could not confirm ${what}.` +
        (r.reason ? `\n\nTheir reason: ${r.reason}` : "") +
        `\n\nYou can report it again from your dashboard: ${link("/tenant")}${sign}`,
  };
}

export function tenantInvite(to: string, tenantName: string, landlordName: string, token: string, days: number): Mail {
  return {
    to,
    subject: `${landlordName} invited you to RentSystem`,
    text:
      `Hi ${tenantName},\n\n${landlordName} invited you to see your lease, invoices and payments online, and to ` +
      `report payments.\n\nOpen this link to accept (it works once, for ${days} days):\n${link(`/invite/${token}`)}${sign}`,
  };
}

type InvoiceInfo = {
  id: string;
  number: number;
  label: string;
  roomLabel: string;
  balance: Amount;
  dueDate: Date;
  graceDays: number;
  lateFee: string | null;
};

// Links go to the tenant's invoice page only when they have an account to open it with.
const invoiceLink = (i: InvoiceInfo, hasAccount: boolean) =>
  hasAccount ? `\n\nSee the invoice and report a payment: ${link(`/tenant/invoices/${i.id}`)}` : "";
const invoiceName = (i: InvoiceInfo) => `INV-${String(i.number).padStart(5, "0")} (${i.label})`;

export function invoiceDueSoon(to: Person, i: InvoiceInfo, hasAccount: boolean): Mail {
  return {
    to: to.email,
    subject: `${i.label} is due on ${toISODate(i.dueDate)}`,
    text:
      `Hi ${to.name},\n\nA reminder that ${invoiceName(i)} for ${i.roomLabel} is due on ${toISODate(i.dueDate)}. ` +
      `${usd(i.balance)} is left to pay.` +
      (i.lateFee ? ` After ${i.graceDays} days' grace a late fee of ${i.lateFee} applies.` : "") +
      invoiceLink(i, hasAccount) +
      `\n\nIf you've already paid, thank you, and please ignore this email.${sign}`,
  };
}

export function invoiceOverdue(to: Person, i: InvoiceInfo, hasAccount: boolean): Mail {
  return {
    to: to.email,
    subject: `${i.label} is overdue`,
    text:
      `Hi ${to.name},\n\n${invoiceName(i)} for ${i.roomLabel} was due on ${toISODate(i.dueDate)} and ` +
      `${usd(i.balance)} is still unpaid. Please pay as soon as you can, or contact your landlord.` +
      invoiceLink(i, hasAccount) +
      `\n\nIf you've paid in the last few days, your landlord may not have recorded it yet.${sign}`,
  };
}
