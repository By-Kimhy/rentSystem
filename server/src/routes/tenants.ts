import { Router } from "express";
import { currentUser } from "../auth.js";
import { paymentRowInclude, tenantDetailInclude, tenantListInclude } from "../contract.js";
import { prisma } from "../db.js";
import { HttpError, parse } from "../errors.js";
import { leaseCreditCents, syncBilling } from "../lib/billing.js";
import { tenantSchema } from "../validation.js";

export const tenantsRouter = Router();

tenantsRouter.get("/tenants", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const tenants = await prisma.tenant.findMany({
    where: {
      landlordId: currentUser(req).id,
      ...(q ? { OR: [{ fullName: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] } : {}),
    },
    orderBy: { fullName: "asc" },
    include: tenantListInclude,
  });
  res.json({ tenants });
});

tenantsRouter.post("/tenants", async (req, res) => {
  const data = parse(tenantSchema, req.body);
  const tenant = await prisma.tenant.create({ data: { ...data, landlordId: currentUser(req).id } });
  res.status(201).json({ tenant });
});

// The tenant with their leases, every invoice and payment on those leases, and unspent credit.
tenantsRouter.get("/tenants/:id", async (req, res) => {
  const landlordId = currentUser(req).id;
  await syncBilling(landlordId);
  const tenant = await prisma.tenant.findFirst({
    where: { id: req.params.id, landlordId },
    include: tenantDetailInclude,
  });
  if (!tenant) throw new HttpError(404, "Tenant not found.");
  const leaseIds = tenant.leases.map((l) => l.leaseId);
  const [invoices, payments, credits] = await Promise.all([
    prisma.invoice.findMany({ where: { leaseId: { in: leaseIds } }, orderBy: [{ dueDate: "desc" }, { number: "desc" }] }),
    prisma.payment.findMany({
      where: { leaseId: { in: leaseIds } },
      orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
      include: paymentRowInclude,
    }),
    Promise.all(leaseIds.map((leaseId) => leaseCreditCents(leaseId))),
  ]);
  res.json({ tenant, invoices, payments, creditCents: credits.reduce((s, c) => s + c, 0) });
});

tenantsRouter.put("/tenants/:id", async (req, res) => {
  const data = parse(tenantSchema, req.body);
  const updated = await prisma.tenant.updateMany({ where: { id: req.params.id, landlordId: currentUser(req).id }, data });
  if (updated.count === 0) throw new HttpError(404, "Tenant not found.");
  res.json({ tenant: await prisma.tenant.findUniqueOrThrow({ where: { id: req.params.id } }) });
});

tenantsRouter.delete("/tenants/:id", async (req, res) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: req.params.id, landlordId: currentUser(req).id },
    include: { _count: { select: { leases: true } } },
  });
  if (!tenant) throw new HttpError(404, "Tenant not found.");
  // Tenants with lease history are kept so invoices and payments stay readable.
  if (tenant._count.leases > 0) throw new HttpError(409, "A tenant who has been on a lease can't be deleted.");
  await prisma.tenant.delete({ where: { id: tenant.id } });
  res.status(204).end();
});
