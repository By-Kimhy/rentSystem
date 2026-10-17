import { Router, type Request } from "express";
import { currentUser } from "../auth.js";
import { UNPAID, paymentDetailInclude, paymentLeaseOptionInclude, paymentRowInclude } from "../contract.js";
import { prisma } from "../db.js";
import { HttpError, parse } from "../errors.js";
import { applyCredit, refreshInvoice, syncBilling } from "../lib/billing.js";
import { ownedLease } from "../lib/leases.js";
import { fromCents, toCents } from "../lib/money.js";
import { paymentSchema, reverseSchema } from "../validation.js";

export const paymentsRouter = Router();

const landlordOf = (req: Request) => currentUser(req).id;

const unpaidInvoices = (leaseId: string) =>
  prisma.invoice.findMany({
    where: { leaseId, status: { in: [...UNPAID] } },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
  });

paymentsRouter.get("/payments", async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { lease: { room: { property: { landlordId: landlordOf(req) } } } },
    orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
    take: 500,
    include: paymentRowInclude,
  });
  res.json({ payments });
});

// What the payment form needs: every billable lease, and the unpaid invoices of `?lease=`.
paymentsRouter.get("/payments/options", async (req, res) => {
  const landlordId = landlordOf(req);
  await syncBilling(landlordId);
  const leases = await prisma.lease.findMany({
    where: { room: { property: { landlordId } }, status: { not: "DRAFT" } },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    include: paymentLeaseOptionInclude,
  });
  const chosen = typeof req.query.lease === "string" ? leases.find((l) => l.id === req.query.lease) : undefined;
  res.json({ leases, invoices: chosen ? await unpaidInvoices(chosen.id) : [] });
});

// Record money received. `allocations` ({ invoiceId: amount }) optionally splits it by hand;
// whatever isn't split goes to the oldest unpaid invoices, and any rest stays as credit.
paymentsRouter.post("/payments", async (req, res) => {
  const landlordId = landlordOf(req);
  const { leaseId, payerTenantId, ...payment } = parse(paymentSchema, req.body);
  const lease = await ownedLease(leaseId, landlordId);
  if (lease.status === "DRAFT") {
    throw new HttpError(400, "Activate the lease first.", { leaseId: ["Activate the lease first."] });
  }
  if (payerTenantId) {
    const onLease = await prisma.leaseTenant.count({ where: { leaseId, tenantId: payerTenantId } });
    if (!onLease) {
      throw new HttpError(400, "Choose a tenant on this lease.", { payerTenantId: ["Choose a tenant on this lease."] });
    }
  }

  const splitError = (message: string) => new HttpError(400, message, { allocations: [message] });
  const requested: Record<string, unknown> =
    typeof req.body?.allocations === "object" && req.body.allocations !== null ? req.body.allocations : {};
  const split: { invoiceId: string; cents: number }[] = [];
  for (const invoice of await unpaidInvoices(leaseId)) {
    const raw = String(requested[invoice.id] ?? "").trim();
    if (raw === "") continue;
    const cents = toCents(Number(raw));
    if (!Number.isFinite(Number(raw)) || cents < 0) throw splitError("Split amounts must be positive numbers.");
    if (cents > toCents(invoice.total) - toCents(invoice.amountPaid)) {
      throw splitError("A split amount is more than that invoice's balance.");
    }
    if (cents > 0) split.push({ invoiceId: invoice.id, cents });
  }
  const amountCents = toCents(payment.amount);
  if (split.reduce((s, a) => s + a.cents, 0) > amountCents) throw splitError("The split adds up to more than the payment.");

  const saved = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        ...payment,
        leaseId,
        payerTenantId,
        amount: fromCents(amountCents),
        receivedById: landlordId,
        allocations: { create: split.map((a) => ({ invoiceId: a.invoiceId, amount: fromCents(a.cents) })) },
      },
    });
    for (const a of split) await refreshInvoice(a.invoiceId, tx);
    return created;
  });
  await applyCredit(leaseId);
  res.status(201).json({ payment: saved });
});

paymentsRouter.get("/payments/:id", async (req, res) => {
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.id, lease: { room: { property: { landlordId: landlordOf(req) } } } },
    include: paymentDetailInclude,
  });
  if (!payment) throw new HttpError(404, "Payment not found.");
  res.json({ payment });
});

// Undo a payment by recording its mirror image, so the history still adds up.
paymentsRouter.post("/payments/:id/reverse", async (req, res) => {
  const landlordId = landlordOf(req);
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.id, lease: { room: { property: { landlordId } } } },
    include: { allocations: true, reversedBy: { select: { id: true } } },
  });
  if (!payment) throw new HttpError(404, "Payment not found.");
  if (payment.reversalOfId) throw new HttpError(409, "A reversal can't itself be reversed.");
  if (payment.reversedBy) throw new HttpError(409, "This payment has already been reversed.");
  const { reason } = parse(reverseSchema, req.body);

  const reversal = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        leaseId: payment.leaseId,
        payerTenantId: payment.payerTenantId,
        amount: payment.amount.negated(),
        method: payment.method,
        paidOn: payment.paidOn,
        reference: payment.reference,
        notes: `Reversal: ${reason}`,
        receivedById: landlordId,
        reversalOfId: payment.id,
        allocations: {
          create: payment.allocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount.negated() })),
        },
      },
    });
    for (const a of payment.allocations) await refreshInvoice(a.invoiceId, tx);
    return created;
  });
  res.status(201).json({ payment: reversal });
});
