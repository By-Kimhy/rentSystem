// Invite links: a landlord links one of their tenant records to the tenant's own account, so a
// tenant they added by hand can see their lease, invoices and payments too.
import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { currentUser } from "../auth.js";
import { prisma } from "../db.js";
import { HttpError } from "../errors.js";

export const INVITE_DAYS = 14;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

// The tenant record an invite token opens, if the token is real, unused and not expired.
async function invited(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { inviteTokenHash: hash(token) },
    select: { id: true, fullName: true, landlordId: true, userId: true, invitedAt: true, landlord: { select: { name: true } } },
  });
  const expired = !tenant?.invitedAt || Date.now() - tenant.invitedAt.getTime() > INVITE_DAYS * 86_400_000;
  return tenant && !tenant.userId && !expired ? tenant : null;
}

const gone = () => new HttpError(404, "This invite link has expired or was already used. Ask your landlord for a new one.");

// ---- Landlord side, mounted at /api/landlord

export const landlordInvitesRouter = Router();

// Creates a new link (replacing any earlier one). The token is returned once and only its hash is kept.
landlordInvitesRouter.post("/tenants/:id/invite", async (req, res) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: req.params.id, landlordId: currentUser(req).id },
    select: { id: true, userId: true },
  });
  if (!tenant) throw new HttpError(404, "Tenant not found.");
  if (tenant.userId) throw new HttpError(409, "This tenant is already linked to their account.");
  const token = randomBytes(24).toString("base64url");
  const invitedAt = new Date();
  await prisma.tenant.update({ where: { id: tenant.id }, data: { inviteTokenHash: hash(token), invitedAt } });
  res.status(201).json({ token, expiresAt: new Date(invitedAt.getTime() + INVITE_DAYS * 86_400_000) });
});

landlordInvitesRouter.delete("/tenants/:id/invite", async (req, res) => {
  const updated = await prisma.tenant.updateMany({
    where: { id: req.params.id, landlordId: currentUser(req).id },
    data: { inviteTokenHash: null, invitedAt: null },
  });
  if (updated.count === 0) throw new HttpError(404, "Tenant not found.");
  res.status(204).end();
});

// ---- Anyone with the link, mounted at /api

export const publicInvitesRouter = Router();

publicInvitesRouter.get("/invites/:token", async (req, res) => {
  const tenant = await invited(req.params.token);
  if (!tenant) throw gone();
  res.json({ invite: { tenantName: tenant.fullName, landlordName: tenant.landlord.name } });
});

// ---- Tenant side, mounted at /api/tenant

export const tenantInvitesRouter = Router();

tenantInvitesRouter.post("/invites/:token/accept", async (req, res) => {
  const userId = currentUser(req).id;
  const tenant = await invited(req.params.token);
  if (!tenant) throw gone();
  const already = await prisma.tenant.count({ where: { landlordId: tenant.landlordId, userId } });
  if (already > 0) {
    throw new HttpError(409, "Your account is already linked to another tenant record with this landlord. Ask them to merge the two.");
  }
  // Only claim the record if it is still unlinked with this same link, so the link works once.
  const claimed = await prisma.tenant.updateMany({
    where: { id: tenant.id, userId: null, inviteTokenHash: hash(req.params.token) },
    data: { userId, inviteTokenHash: null, invitedAt: null },
  });
  if (claimed.count === 0) throw gone();
  res.status(204).end();
});
