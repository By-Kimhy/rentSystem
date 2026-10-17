// Invoices, payments and overdue tracking. Every function here is idempotent: running the
// billing sync twice, or from two requests at once, produces the same invoices.
import "server-only";
import { Prisma, type InvoiceStatus, type Lease } from "@prisma/client";
import { prisma } from "./db";
import {
  addDays,
  dateInPeriod,
  daysBetween,
  daysInPeriod,
  formatPeriod,
  maxDate,
  minDate,
  nextPeriod,
  periodEnd,
  periodOf,
  periodStart,
  today,
} from "./dates";
import { fromCents, toCents } from "./money";

// Rent invoices are issued this many days before they are due.
export const INVOICE_LEAD_DAYS = 7;

type Db = Prisma.TransactionClient | typeof prisma;

// The last day the tenant occupies the room, or null while it runs open-ended.
export function leaseLastDay(lease: Pick<Lease, "endDate" | "terminatedOn">): Date | null {
  return lease.terminatedOn ?? lease.endDate;
}

export function dueDateFor(lease: Pick<Lease, "startDate" | "dueDay">, period: string): Date {
  // The first month can start after its due day; then rent is due on move-in.
  return maxDate(dateInPeriod(period, lease.dueDay), lease.startDate);
}

// Rent for one calendar month, prorated by the days the lease covers in it.
export function rentForPeriod(
  lease: Pick<Lease, "startDate" | "endDate" | "terminatedOn" | "rentAmount">,
  period: string,
): { cents: number; description: string } {
  const last = leaseLastDay(lease);
  const from = maxDate(periodStart(period), lease.startDate);
  const to = last ? minDate(periodEnd(period), last) : periodEnd(period);
  const days = Math.max(0, daysBetween(from, to) + 1);
  const total = daysInPeriod(period);
  const rent = toCents(lease.rentAmount);
  const label = `Rent for ${formatPeriod(period)}`;
  if (days >= total) return { cents: rent, description: label };
  return { cents: Math.round((rent * days) / total), description: `${label} (${days} of ${total} days)` };
}

export function computeStatus(opts: {
  totalCents: number;
  paidCents: number;
  dueDate: Date;
  graceDays: number;
  voided: boolean;
  on: Date;
}): InvoiceStatus {
  if (opts.voided) return "VOID";
  if (opts.paidCents >= opts.totalCents) return "PAID";
  if (opts.on > addDays(opts.dueDate, opts.graceDays)) return "OVERDUE";
  return opts.paidCents > 0 ? "PARTIAL" : "OPEN";
}

export function daysOverdue(dueDate: Date, on = today()): number {
  return Math.max(0, daysBetween(dueDate, on));
}

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// Recompute an invoice's total, amount paid and status from its lines and allocations,
// adding the late fee the first time it turns overdue.
export async function refreshInvoice(invoiceId: string, db: Db = prisma, on = today()) {
  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { lease: true, lines: true },
  });
  const paid = await db.paymentAllocation.aggregate({ where: { invoiceId }, _sum: { amount: true } });
  const paidCents = toCents(paid._sum.amount ?? 0);
  let totalCents = invoice.lines.reduce((sum, l) => sum + toCents(l.amount), 0);
  const { lease } = invoice;

  let status = computeStatus({
    totalCents,
    paidCents,
    dueDate: invoice.dueDate,
    graceDays: lease.graceDays,
    voided: invoice.status === "VOID",
    on,
  });

  if (status === "OVERDUE" && invoice.kind === "RENT" && lease.lateFeeType !== "NONE" && !invoice.lateFeeApplied) {
    // Claim the fee first so two concurrent syncs can't both add it.
    const claimed = await db.invoice.updateMany({
      where: { id: invoiceId, lateFeeApplied: false },
      data: { lateFeeApplied: true },
    });
    if (claimed.count === 1) {
      const rentCents = invoice.lines.filter((l) => l.kind === "RENT").reduce((s, l) => s + toCents(l.amount), 0);
      const feeCents =
        lease.lateFeeType === "FLAT"
          ? toCents(lease.lateFeeValue)
          : Math.round((rentCents * Number(lease.lateFeeValue)) / 100);
      if (feeCents > 0) {
        await db.invoiceLine.create({
          data: { invoiceId, kind: "LATE_FEE", description: "Late fee", amount: fromCents(feeCents) },
        });
        totalCents += feeCents;
        status = paidCents >= totalCents ? "PAID" : "OVERDUE";
      }
    }
  }

  await db.invoice.update({
    where: { id: invoiceId },
    data: { total: fromCents(totalCents), amountPaid: fromCents(paidCents), status },
  });
}

// Create every rent invoice that is due within the lead time and not yet issued.
async function issueRentInvoices(lease: Lease, on: Date) {
  const last = leaseLastDay(lease);
  const existing = new Set(
    (await prisma.invoice.findMany({ where: { leaseId: lease.id, kind: "RENT" }, select: { period: true } })).map(
      (i) => i.period,
    ),
  );
  for (let period = periodOf(lease.startDate); ; period = nextPeriod(period)) {
    if (last && periodStart(period) > last) break;
    const dueDate = dueDateFor(lease, period);
    if (addDays(dueDate, -INVOICE_LEAD_DAYS) > on) break;
    if (existing.has(period)) continue;
    const rent = rentForPeriod(lease, period);
    if (rent.cents <= 0) continue;
    try {
      await prisma.invoice.create({
        data: {
          leaseId: lease.id,
          kind: "RENT",
          period,
          issueDate: minDate(on, dueDate),
          dueDate,
          total: fromCents(rent.cents),
          lines: { create: { kind: "RENT", description: rent.description, amount: fromCents(rent.cents) } },
        },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e; // another request issued it first
    }
  }
}

// Money paid on the lease but not yet allocated to any invoice.
export async function leaseCreditCents(leaseId: string, db: Db = prisma): Promise<number> {
  const [paid, allocated] = await Promise.all([
    db.payment.aggregate({ where: { leaseId }, _sum: { amount: true } }),
    db.paymentAllocation.aggregate({ where: { payment: { leaseId } }, _sum: { amount: true } }),
  ]);
  return toCents(paid._sum.amount ?? 0) - toCents(allocated._sum.amount ?? 0);
}

// Spend unallocated payment money on the lease's unpaid invoices, oldest due first.
export async function applyCredit(leaseId: string, db: Db = prisma, on = today()) {
  const payments = await db.payment.findMany({
    where: { leaseId, reversalOfId: null, reversedBy: null },
    orderBy: [{ paidOn: "asc" }, { createdAt: "asc" }],
    include: { allocations: { select: { amount: true } } },
  });
  const sources = payments
    .map((p) => ({ id: p.id, left: toCents(p.amount) - p.allocations.reduce((s, a) => s + toCents(a.amount), 0) }))
    .filter((p) => p.left > 0);
  if (sources.length === 0) return;

  const invoices = await db.invoice.findMany({
    where: { leaseId, status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
  });
  for (const invoice of invoices) {
    let owed = toCents(invoice.total) - toCents(invoice.amountPaid);
    for (const source of sources) {
      if (owed <= 0) break;
      if (source.left <= 0) continue;
      const take = Math.min(owed, source.left);
      await db.paymentAllocation.create({
        data: { paymentId: source.id, invoiceId: invoice.id, amount: fromCents(take) },
      });
      source.left -= take;
      owed -= take;
    }
    await refreshInvoice(invoice.id, db, on);
    if (sources.every((s) => s.left <= 0)) break;
  }
}

async function syncLease(lease: Lease, on: Date) {
  await issueRentInvoices(lease, on);
  await applyCredit(lease.id, prisma, on);
  const unpaid = await prisma.invoice.findMany({
    where: { leaseId: lease.id, status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } },
    select: { id: true },
  });
  for (const invoice of unpaid) await refreshInvoice(invoice.id, prisma, on);
}

// Bring a landlord's invoices up to date: issue new rent invoices, apply credit,
// mark late ones overdue and add late fees. Called by the rent pages and the cron route.
export async function syncBilling(landlordId?: string) {
  const on = today();
  const leases = await prisma.lease.findMany({
    where: {
      status: { not: "DRAFT" },
      ...(landlordId ? { room: { property: { landlordId } } } : {}),
    },
  });
  for (const lease of leases) await syncLease(lease, on);
}

export async function issueDepositInvoice(lease: Lease, db: Db = prisma) {
  if (toCents(lease.depositAmount) <= 0) return;
  const on = today();
  await db.invoice.create({
    data: {
      leaseId: lease.id,
      kind: "DEPOSIT",
      issueDate: on,
      dueDate: maxDate(on, lease.startDate),
      total: lease.depositAmount,
      lines: { create: { kind: "DEPOSIT", description: "Security deposit", amount: lease.depositAmount } },
    },
  });
}

// After a lease ends early, void untouched rent invoices past the end and re-prorate the last month.
export async function trimInvoicesAfterEnd(lease: Lease, db: Db = prisma) {
  const last = leaseLastDay(lease);
  if (!last) return;
  const lastPeriod = periodOf(last);
  const invoices = await db.invoice.findMany({
    where: { leaseId: lease.id, kind: "RENT", status: { not: "VOID" }, period: { gte: lastPeriod } },
    include: { lines: true, allocations: { select: { id: true } } },
  });
  for (const invoice of invoices) {
    if (invoice.allocations.length > 0) continue; // money already applied: leave it to the landlord
    if (invoice.period! > lastPeriod) {
      await db.invoice.update({ where: { id: invoice.id }, data: { status: "VOID", voidReason: "Lease ended" } });
      continue;
    }
    const rent = rentForPeriod(lease, invoice.period!);
    const rentLine = invoice.lines.find((l) => l.kind === "RENT");
    if (rentLine && toCents(rentLine.amount) !== rent.cents) {
      await db.invoiceLine.update({
        where: { id: rentLine.id },
        data: { amount: fromCents(rent.cents), description: rent.description },
      });
      await refreshInvoice(invoice.id, db);
    }
  }
}

// Deposit money held for a lease: what was paid on its deposit invoices, less deductions and refunds.
export async function depositSummary(leaseId: string) {
  const [paid, txns] = await Promise.all([
    prisma.paymentAllocation.aggregate({
      where: { invoice: { leaseId, kind: "DEPOSIT" } },
      _sum: { amount: true },
    }),
    prisma.depositTransaction.findMany({ where: { leaseId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
  ]);
  const receivedCents = toCents(paid._sum.amount ?? 0);
  const deductedCents = txns.filter((t) => t.kind === "DEDUCTION").reduce((s, t) => s + toCents(t.amount), 0);
  const refundedCents = txns.filter((t) => t.kind === "REFUND").reduce((s, t) => s + toCents(t.amount), 0);
  return {
    receivedCents,
    deductedCents,
    refundedCents,
    heldCents: receivedCents - deductedCents - refundedCents,
    transactions: txns,
  };
}
