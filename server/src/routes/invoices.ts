import { Router, type Request } from "express";
import type { InvoiceStatus } from "@prisma/client";
import { currentUser } from "../auth.js";
import { invoiceDetailInclude, invoiceListInclude } from "../contract.js";
import { prisma } from "../db.js";
import { HttpError, parse } from "../errors.js";
import { applyCredit, refreshInvoice, syncBilling } from "../lib/billing.js";
import { chargeSchema, voidSchema } from "../validation.js";

export const invoicesRouter = Router();

const landlordOf = (req: Request) => currentUser(req).id;

// `show` filters: "" unpaid (default), "overdue", "paid", "void", "all".
const FILTERS: Record<string, InvoiceStatus[] | null> = {
  "": ["OPEN", "PARTIAL", "OVERDUE"],
  overdue: ["OVERDUE"],
  paid: ["PAID"],
  void: ["VOID"],
  all: null,
};

async function ownedInvoice(invoiceId: string, landlordId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, lease: { room: { property: { landlordId } } } },
    include: { _count: { select: { allocations: true } } },
  });
  if (!invoice) throw new HttpError(404, "Invoice not found.");
  return invoice;
}

invoicesRouter.get("/invoices", async (req, res) => {
  const landlordId = landlordOf(req);
  await syncBilling(landlordId);
  const show = typeof req.query.show === "string" && req.query.show in FILTERS ? req.query.show : "";
  const statuses = FILTERS[show];
  const invoices = await prisma.invoice.findMany({
    where: {
      lease: { room: { property: { landlordId } } },
      ...(statuses ? { status: { in: statuses } } : {}),
    },
    // Unpaid lists put the most urgent first; history lists the newest first.
    orderBy: [{ dueDate: show === "" || show === "overdue" ? "asc" : "desc" }, { number: "desc" }],
    take: 500,
    include: invoiceListInclude,
  });
  res.json({ invoices });
});

invoicesRouter.get("/invoices/:id", async (req, res) => {
  const landlordId = landlordOf(req);
  await syncBilling(landlordId);
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, lease: { room: { property: { landlordId } } } },
    include: invoiceDetailInclude,
  });
  if (!invoice) throw new HttpError(404, "Invoice not found.");
  res.json({ invoice });
});

// Add a line to an invoice that isn't settled yet.
invoicesRouter.post("/invoices/:id/lines", async (req, res) => {
  const invoice = await ownedInvoice(req.params.id, landlordOf(req));
  if (invoice.status === "VOID" || invoice.status === "PAID") {
    throw new HttpError(409, "This invoice is closed. Bill a new charge instead.");
  }
  const line = parse(chargeSchema.omit({ dueDate: true }), req.body);
  await prisma.invoiceLine.create({ data: { invoiceId: invoice.id, ...line } });
  await refreshInvoice(invoice.id);
  await applyCredit(invoice.leaseId);
  res.status(201).json({ invoice: await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } }) });
});

invoicesRouter.post("/invoices/:id/void", async (req, res) => {
  const invoice = await ownedInvoice(req.params.id, landlordOf(req));
  if (invoice.status === "VOID") throw new HttpError(409, "This invoice is already void.");
  if (invoice._count.allocations > 0) {
    throw new HttpError(409, "Payments are applied to this invoice. Reverse them first, then void it.");
  }
  const { reason } = parse(voidSchema, req.body);
  const voided = await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "VOID", voidReason: reason } });
  res.json({ invoice: voided });
});
