// Payment reports: a tenant says they paid; the landlord confirms (recording the payment) or rejects.
import { Router } from "express";
import { currentUser } from "../auth.js";
import { paymentReportInclude, tenantPaymentReportSelect } from "../contract.js";
import { prisma } from "../db.js";
import { HttpError, parse } from "../errors.js";
import { applyCredit } from "../lib/billing.js";
import { today } from "../lib/dates.js";
import { paymentReportSchema, rejectReportSchema } from "../validation.js";
import { myLeases } from "./tenantHome.js";

// ---- Tenant side, mounted at /api/tenant

export const tenantPaymentReportsRouter = Router();

tenantPaymentReportsRouter.post("/payment-reports", async (req, res) => {
  const reporterId = currentUser(req).id;
  const data = parse(paymentReportSchema, req.body);
  const lease = await prisma.lease.findFirst({ where: { id: data.leaseId, ...myLeases(reporterId) }, select: { id: true } });
  if (!lease) throw new HttpError(404, "Lease not found.");
  if (data.paidOn > today()) {
    throw new HttpError(400, "Some fields are invalid.", { paidOn: ["The payment date can't be in the future."] });
  }
  const report = await prisma.paymentReport.create({
    data: { ...data, reporterId },
    select: tenantPaymentReportSelect,
  });
  res.status(201).json({ report });
});

tenantPaymentReportsRouter.post("/payment-reports/:id/cancel", async (req, res) => {
  const updated = await prisma.paymentReport.updateMany({
    where: { id: req.params.id, reporterId: currentUser(req).id, status: "PENDING" },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });
  if (updated.count === 0) throw new HttpError(409, "Only a report that is still waiting can be cancelled.");
  res.status(204).end();
});

// ---- Landlord side, mounted at /api/landlord

export const landlordPaymentReportsRouter = Router();

const ownedBy = (landlordId: string) => ({ lease: { room: { property: { landlordId } } } });

// GET /payment-reports?show=all  (default: waiting for a decision)
landlordPaymentReportsRouter.get("/payment-reports", async (req, res) => {
  const all = req.query.show === "all";
  const reports = await prisma.paymentReport.findMany({
    where: { ...ownedBy(currentUser(req).id), ...(all ? {} : { status: "PENDING" }) },
    include: paymentReportInclude,
    orderBy: { createdAt: all ? "desc" : "asc" },
    take: 200,
  });
  res.json({ reports });
});

async function ownedReport(id: string, landlordId: string) {
  const report = await prisma.paymentReport.findFirst({ where: { id, ...ownedBy(landlordId) } });
  if (!report) throw new HttpError(404, "Payment report not found.");
  return report;
}

const decided = () => new HttpError(409, "This report has already been dealt with.");

// Confirming records the payment exactly as reported, paid by the reporter's tenant record on
// the lease, and spends it on the oldest unpaid invoices like any other payment.
landlordPaymentReportsRouter.post("/payment-reports/:id/confirm", async (req, res) => {
  const landlordId = currentUser(req).id;
  const report = await ownedReport(req.params.id, landlordId);
  const payer = await prisma.leaseTenant.findFirst({
    where: { leaseId: report.leaseId, tenant: { userId: report.reporterId } },
    select: { tenantId: true },
  });
  const payment = await prisma.$transaction(async (tx) => {
    // Claim the report first so two confirmations can't both record a payment.
    const claimed = await tx.paymentReport.updateMany({
      where: { id: report.id, status: "PENDING" },
      data: { status: "CONFIRMED", decidedAt: new Date() },
    });
    if (claimed.count === 0) throw decided();
    const created = await tx.payment.create({
      data: {
        leaseId: report.leaseId,
        payerTenantId: payer?.tenantId ?? null,
        amount: report.amount,
        method: report.method,
        paidOn: report.paidOn,
        reference: report.reference,
        notes: report.note ? `Reported by tenant: ${report.note}` : "Reported by tenant",
        receivedById: landlordId,
      },
    });
    await tx.paymentReport.update({ where: { id: report.id }, data: { paymentId: created.id } });
    return created;
  });
  await applyCredit(report.leaseId);
  res.json({ payment });
});

landlordPaymentReportsRouter.post("/payment-reports/:id/reject", async (req, res) => {
  const report = await ownedReport(req.params.id, currentUser(req).id);
  const { reason } = parse(rejectReportSchema, req.body);
  const updated = await prisma.paymentReport.updateMany({
    where: { id: report.id, status: "PENDING" },
    data: { status: "REJECTED", rejectReason: reason, decidedAt: new Date() },
  });
  if (updated.count === 0) throw decided();
  res.status(204).end();
});
