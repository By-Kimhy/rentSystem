// A tenant's own rentals: the leases their account is linked to, with invoices and payments.
import { Router } from "express";
import { currentUser } from "../auth.js";
import {
  tenantInvoiceInclude,
  tenantLeaseSelect,
  tenantPaymentReportSelect,
  tenantPaymentSelect,
} from "../contract.js";
import { prisma } from "../db.js";
import { HttpError } from "../errors.js";
import { depositSummary, leaseCreditCents, syncLeases } from "../lib/billing.js";

export const tenantHomeRouter = Router();

// Drafts aren't agreed yet, so the tenant doesn't see them.
export const myLeases = (userId: string) => ({ status: { not: "DRAFT" as const }, tenants: { some: { tenant: { userId } } } });

tenantHomeRouter.get("/home", async (req, res) => {
  const userId = currentUser(req).id;
  await syncLeases(myLeases(userId));
  const leases = await prisma.lease.findMany({
    where: myLeases(userId),
    select: tenantLeaseSelect,
    orderBy: { startDate: "desc" },
  });
  const leaseIds = leases.map((l) => l.id);
  const [invoices, payments, paymentReports, money] = await Promise.all([
    prisma.invoice.findMany({
      where: { leaseId: { in: leaseIds }, status: { not: "VOID" } },
      orderBy: [{ dueDate: "desc" }, { number: "desc" }],
    }),
    prisma.payment.findMany({
      where: { leaseId: { in: leaseIds } },
      select: tenantPaymentSelect,
      orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
    }),
    prisma.paymentReport.findMany({
      where: { leaseId: { in: leaseIds }, reporterId: userId },
      select: tenantPaymentReportSelect,
      orderBy: { createdAt: "desc" },
    }),
    Promise.all(
      leaseIds.map(async (id) => {
        const [credit, deposit] = await Promise.all([leaseCreditCents(id), depositSummary(id)]);
        return { credit, deposit };
      }),
    ),
  ]);
  res.json({
    leases: leases.map((l, i) => ({ ...l, creditCents: money[i].credit, depositHeldCents: money[i].deposit.heldCents })),
    invoices,
    payments,
    paymentReports,
  });
});

tenantHomeRouter.get("/invoices/:id", async (req, res) => {
  const userId = currentUser(req).id;
  const where = { id: req.params.id, status: { not: "VOID" as const }, lease: myLeases(userId) };
  const found = await prisma.invoice.findFirst({ where, select: { leaseId: true } });
  if (!found) throw new HttpError(404, "Invoice not found.");
  await syncLeases({ id: found.leaseId });
  const invoice = await prisma.invoice.findFirstOrThrow({ where, include: tenantInvoiceInclude });
  res.json({ invoice });
});
