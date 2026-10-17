import { Router, type Request } from "express";
import type { LeaseStatus } from "@prisma/client";
import { currentUser } from "../auth.js";
import { leaseDetailInclude, leaseFormPropertyInclude, leaseListInclude } from "../contract.js";
import { prisma } from "../db.js";
import { HttpError, parse } from "../errors.js";
import {
  applyCredit,
  depositSummary,
  issueDepositInvoice,
  leaseCreditCents,
  refreshInvoice,
  syncBilling,
  trimInvoicesAfterEnd,
} from "../lib/billing.js";
import { addDays, daysBetween, today, toISODate } from "../lib/dates.js";
import { ownedLease, overlappingLease, syncRoomStatus } from "../lib/leases.js";
import { fromCents, toCents } from "../lib/money.js";
import { chargeSchema, depositTransactionSchema, endLeaseSchema, leaseSchema } from "../validation.js";

export const leasesRouter = Router();

const landlordOf = (req: Request) => currentUser(req).id;

// Activate a draft: refuse if the room is already let for overlapping dates.
// Returns an error message, or null once the lease is active.
async function activate(leaseId: string): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const lease = await tx.lease.findUniqueOrThrow({ where: { id: leaseId } });
    if (lease.status !== "DRAFT") return "Only a draft lease can be activated.";
    // Lock the room row so two activations for the same room can't both pass the check.
    await tx.$queryRaw`SELECT id FROM Room WHERE id = ${lease.roomId} FOR UPDATE`;
    const clash = await overlappingLease(tx, {
      leaseId,
      roomId: lease.roomId,
      start: lease.startDate,
      end: lease.endDate,
    });
    if (clash) {
      const who = clash.tenants[0]?.tenant.fullName ?? "another tenant";
      return `This room is already let to ${who} from ${toISODate(clash.startDate)}${
        clash.endDate ? ` to ${toISODate(clash.endDate)}` : ""
      }. End that lease first or change the dates.`;
    }
    const active = await tx.lease.update({ where: { id: leaseId }, data: { status: "ACTIVE" } });
    await syncRoomStatus(tx, lease.roomId);
    await issueDepositInvoice(active, tx);
    return null;
  });
}

leasesRouter.get("/leases", async (req, res) => {
  const show = typeof req.query.show === "string" ? req.query.show : "";
  const now = today();
  const statusFilter =
    show === "ACTIVE" || show === "DRAFT"
      ? { status: show as LeaseStatus }
      : show === "past"
        ? { status: { in: ["ENDED", "TERMINATED"] as LeaseStatus[] } }
        : show === "ending"
          ? { status: "ACTIVE" as const, endDate: { gte: now, lte: addDays(now, 60) } }
          : {};
  const leases = await prisma.lease.findMany({
    where: { room: { property: { landlordId: landlordOf(req) } }, ...statusFilter },
    orderBy: [{ startDate: "desc" }],
    include: leaseListInclude,
  });
  res.json({ leases });
});

// Rooms and tenants a lease form can choose from.
leasesRouter.get("/leases/options", async (req, res) => {
  const landlordId = landlordOf(req);
  const [properties, tenants] = await Promise.all([
    prisma.property.findMany({ where: { landlordId }, orderBy: { name: "asc" }, include: leaseFormPropertyInclude }),
    prisma.tenant.findMany({ where: { landlordId }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);
  res.json({ properties: properties.filter((p) => p.rooms.length > 0), tenants });
});

leasesRouter.get("/leases/:id", async (req, res) => {
  const landlordId = landlordOf(req);
  await syncBilling(landlordId);
  const lease = await prisma.lease.findFirst({
    where: { id: req.params.id, room: { property: { landlordId } } },
    include: leaseDetailInclude,
  });
  if (!lease) throw new HttpError(404, "Lease not found.");
  const [creditCents, deposit] = await Promise.all([leaseCreditCents(lease.id), depositSummary(lease.id)]);
  res.json({ lease, creditCents, deposit });
});

// Create (POST) or edit a draft (PUT). With `intent: "activate"` the lease is activated straight
// after saving; if the room is taken, the draft is still saved and activationError says why.
async function saveLease(req: Request, leaseId: string | null) {
  const landlordId = landlordOf(req);
  const { primaryTenantId, otherTenantIds: others, rentAmount, ...terms } = parse(leaseSchema, req.body);

  if (leaseId) {
    const existing = await ownedLease(leaseId, landlordId);
    if (existing.status !== "DRAFT") throw new HttpError(409, "Only a draft lease can be edited.");
  }
  const room = await prisma.room.findFirst({ where: { id: terms.roomId, property: { landlordId } } });
  if (!room) throw new HttpError(400, "Choose a room.", { roomId: ["Choose a room."] });

  const tenantIds = [primaryTenantId, ...others.filter((id) => id !== primaryTenantId)];
  const owned = await prisma.tenant.count({ where: { id: { in: tenantIds }, landlordId } });
  if (owned !== tenantIds.length) {
    throw new HttpError(400, "Choose your tenants.", { primaryTenantId: ["Choose your tenants."] });
  }
  if (tenantIds.length > room.maxOccupants) {
    const message = `${room.name} allows up to ${room.maxOccupants} occupants.`;
    throw new HttpError(400, message, { otherTenantIds: [message] });
  }

  const data = { ...terms, rentAmount: rentAmount ?? room.rentPrice };
  const tenants = { create: tenantIds.map((tenantId, i) => ({ tenantId, isPrimary: i === 0 })) };
  let lease = leaseId
    ? await prisma.$transaction(async (tx) => {
        await tx.leaseTenant.deleteMany({ where: { leaseId } });
        return tx.lease.update({ where: { id: leaseId }, data: { ...data, tenants } });
      })
    : await prisma.lease.create({ data: { ...data, tenants } });

  let activationError: string | undefined;
  if (req.body?.intent === "activate") {
    activationError = (await activate(lease.id)) ?? undefined;
    if (!activationError) {
      await syncBilling(landlordId);
      lease = await prisma.lease.findUniqueOrThrow({ where: { id: lease.id } });
    }
  }
  return { lease, activationError };
}

leasesRouter.post("/leases", async (req, res) => {
  res.status(201).json(await saveLease(req, null));
});

leasesRouter.put("/leases/:id", async (req, res) => {
  res.json(await saveLease(req, req.params.id));
});

leasesRouter.post("/leases/:id/activate", async (req, res) => {
  const landlordId = landlordOf(req);
  await ownedLease(req.params.id, landlordId);
  const error = await activate(req.params.id);
  if (error) throw new HttpError(409, error);
  await syncBilling(landlordId);
  res.json({ lease: await prisma.lease.findUniqueOrThrow({ where: { id: req.params.id } }) });
});

leasesRouter.post("/leases/:id/end", async (req, res) => {
  const landlordId = landlordOf(req);
  const lease = await ownedLease(req.params.id, landlordId);
  if (lease.status !== "ACTIVE") throw new HttpError(409, "Only an active lease can be ended.");
  const { endOn } = parse(endLeaseSchema, req.body);
  if (endOn < lease.startDate) throw new HttpError(400, "The last day can't be before the lease starts.");

  // Ending on or after the agreed end date is a normal end; before it is an early termination.
  const data = !lease.endDate
    ? { status: "ENDED" as const, endDate: endOn }
    : endOn >= lease.endDate
      ? { status: "ENDED" as const }
      : { status: "TERMINATED" as const, terminatedOn: endOn };

  const ended = await prisma.$transaction(async (tx) => {
    const updated = await tx.lease.update({ where: { id: lease.id }, data });
    await syncRoomStatus(tx, lease.roomId);
    await trimInvoicesAfterEnd(updated, tx);
    return updated;
  });
  await syncBilling(landlordId);
  res.json({ lease: ended });
});

// Renewal starts a new draft with the same terms, beginning the day after this lease ends.
// Renewing twice returns the existing renewal.
leasesRouter.post("/leases/:id/renew", async (req, res) => {
  const lease = await prisma.lease.findFirst({
    where: { id: req.params.id, room: { property: { landlordId: landlordOf(req) } } },
    include: { tenants: true, renewedBy: true },
  });
  if (!lease) throw new HttpError(404, "Lease not found.");
  if (lease.renewedBy) {
    res.json({ lease: lease.renewedBy });
    return;
  }
  const lastDay = lease.terminatedOn ?? lease.endDate;
  if (!lastDay) throw new HttpError(409, "A month-to-month lease doesn't need renewing.");

  const renewal = await prisma.lease.create({
    data: {
      roomId: lease.roomId,
      startDate: addDays(lastDay, 1),
      // Same length as the original term.
      endDate: lease.endDate ? addDays(lastDay, 1 + daysBetween(lease.startDate, lease.endDate)) : null,
      rentAmount: lease.rentAmount,
      dueDay: lease.dueDay,
      // The deposit carries over, so the renewal doesn't bill it again.
      depositAmount: 0,
      graceDays: lease.graceDays,
      lateFeeType: lease.lateFeeType,
      lateFeeValue: lease.lateFeeValue,
      notes: `Renewal of the lease that ended ${toISODate(lastDay)}. The original deposit is still held on that lease.`,
      renewedFromId: lease.id,
      tenants: { create: lease.tenants.map((t) => ({ tenantId: t.tenantId, isPrimary: t.isPrimary })) },
    },
  });
  res.status(201).json({ lease: renewal });
});

leasesRouter.delete("/leases/:id", async (req, res) => {
  const lease = await ownedLease(req.params.id, landlordOf(req));
  if (lease.status !== "DRAFT") throw new HttpError(409, "Only a draft lease can be deleted.");
  await prisma.lease.delete({ where: { id: lease.id } });
  res.status(204).end();
});

// A one-off charge (repair, utility) billed on its own invoice.
leasesRouter.post("/leases/:id/charges", async (req, res) => {
  const lease = await ownedLease(req.params.id, landlordOf(req));
  if (lease.status === "DRAFT") throw new HttpError(409, "Activate the lease before billing it.");
  const { kind, description, amount, dueDate } = parse(chargeSchema, req.body);
  const invoice = await prisma.invoice.create({
    data: {
      leaseId: lease.id,
      kind: "OTHER",
      issueDate: today(),
      dueDate,
      total: amount,
      lines: { create: { kind, description, amount } },
    },
  });
  await refreshInvoice(invoice.id);
  await applyCredit(lease.id);
  res.status(201).json({ invoice: await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } }) });
});

// Move-out settlement: deduct from or refund the deposit held.
leasesRouter.post("/leases/:id/deposit-transactions", async (req, res) => {
  const lease = await ownedLease(req.params.id, landlordOf(req));
  if (lease.status !== "ENDED" && lease.status !== "TERMINATED") {
    throw new HttpError(409, "Settle the deposit after the lease has ended.");
  }
  const { kind, amount, date, reason } = parse(depositTransactionSchema, req.body);
  if (kind === "DEDUCTION" && !reason) {
    throw new HttpError(400, "Say what the deduction is for.", { reason: ["Say what the deduction is for."] });
  }
  const { heldCents } = await depositSummary(lease.id);
  if (toCents(amount) > heldCents) {
    const held = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(fromCents(heldCents)));
    throw new HttpError(409, `That's more than the ${held} deposit still held.`);
  }
  const transaction = await prisma.depositTransaction.create({ data: { leaseId: lease.id, kind, amount, date, reason } });
  res.status(201).json({ transaction });
});

