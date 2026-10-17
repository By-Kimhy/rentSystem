// Rental applications: tenants apply for listed rooms, landlords approve or reject them.
import { Router } from "express";
import { currentUser } from "../auth.js";
import { applicationInclude, myApplicationInclude } from "../contract.js";
import { prisma } from "../db.js";
import { HttpError, parse } from "../errors.js";
import { today } from "../lib/dates.js";
import { applicationSchema } from "../validation.js";

// ---- Tenant side, mounted at /api/tenant

export const tenantApplicationsRouter = Router();

tenantApplicationsRouter.get("/applications", async (req, res) => {
  const applications = await prisma.application.findMany({
    where: { applicantId: currentUser(req).id },
    include: myApplicationInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json({ applications });
});

tenantApplicationsRouter.post("/applications", async (req, res) => {
  const applicantId = currentUser(req).id;
  const data = parse(applicationSchema, req.body);
  const room = await prisma.room.findUnique({ where: { id: data.roomId } });
  if (!room || room.status !== "AVAILABLE") throw new HttpError(409, "This room is no longer available.");
  if (data.moveInDate < today()) {
    throw new HttpError(400, "Some fields are invalid.", { moveInDate: ["Move-in date can't be in the past."] });
  }
  if (data.occupants > room.maxOccupants) {
    const fits = room.maxOccupants === 1 ? "1 person" : `up to ${room.maxOccupants} people`;
    throw new HttpError(400, "Some fields are invalid.", { occupants: [`This room fits ${fits}.`] });
  }
  const pending = await prisma.application.count({ where: { roomId: room.id, applicantId, status: "PENDING" } });
  if (pending > 0) throw new HttpError(409, "You have already applied for this room.");

  const application = await prisma.application.create({
    data: { ...data, applicantId },
    include: myApplicationInclude,
  });
  res.status(201).json({ application });
});

tenantApplicationsRouter.post("/applications/:id/withdraw", async (req, res) => {
  const updated = await prisma.application.updateMany({
    where: { id: req.params.id, applicantId: currentUser(req).id, status: "PENDING" },
    data: { status: "WITHDRAWN" },
  });
  if (updated.count === 0) throw new HttpError(409, "Only a pending application can be withdrawn.");
  res.status(204).end();
});

// ---- Landlord side, mounted at /api/landlord

export const landlordApplicationsRouter = Router();

const ownedBy = (landlordId: string) => ({ room: { property: { landlordId } } });

// GET /applications?show=all  (default: pending only)
landlordApplicationsRouter.get("/applications", async (req, res) => {
  const all = req.query.show === "all";
  const applications = await prisma.application.findMany({
    where: { ...ownedBy(currentUser(req).id), ...(all ? {} : { status: "PENDING" }) },
    include: applicationInclude,
    orderBy: { createdAt: all ? "desc" : "asc" },
  });
  res.json({ applications });
});

landlordApplicationsRouter.get("/applications/:id", async (req, res) => {
  const application = await prisma.application.findFirst({
    where: { id: req.params.id, ...ownedBy(currentUser(req).id) },
    include: applicationInclude,
  });
  if (!application) throw new HttpError(404, "Application not found.");
  res.json({ application });
});

async function pendingApplication(id: string, landlordId: string) {
  const application = await prisma.application.findFirst({
    where: { id, ...ownedBy(landlordId) },
    include: { applicant: { select: { name: true, email: true } } },
  });
  if (!application) throw new HttpError(404, "Application not found.");
  if (application.status !== "PENDING") throw new HttpError(409, "This application has already been decided.");
  return application;
}

// Approving links the applicant to one of the landlord's tenant records, creating it the first
// time, so a returning tenant isn't added twice. The lease is written next, on the lease form.
landlordApplicationsRouter.post("/applications/:id/approve", async (req, res) => {
  const landlordId = currentUser(req).id;
  const application = await pendingApplication(req.params.id, landlordId);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.tenant.findFirst({ where: { landlordId, userId: application.applicantId } });
    const tenant =
      existing ??
      (await tx.tenant.create({
        data: {
          landlordId,
          userId: application.applicantId,
          fullName: application.applicant.name,
          phone: application.phone,
          email: application.applicant.email,
        },
      }));
    return tx.application.update({
      where: { id: application.id },
      data: { status: "APPROVED", decidedAt: new Date(), tenantId: tenant.id },
      include: applicationInclude,
    });
  });
  res.json({ application: result });
});

landlordApplicationsRouter.post("/applications/:id/reject", async (req, res) => {
  const application = await pendingApplication(req.params.id, currentUser(req).id);
  const updated = await prisma.application.update({
    where: { id: application.id },
    data: { status: "REJECTED", decidedAt: new Date() },
    include: applicationInclude,
  });
  res.json({ application: updated });
});
