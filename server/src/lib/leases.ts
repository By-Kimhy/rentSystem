import type { Lease, Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { HttpError } from "../errors.js";

type Db = Prisma.TransactionClient | typeof prisma;

export async function ownedLease(leaseId: string, landlordId: string) {
  const lease = await prisma.lease.findFirst({ where: { id: leaseId, room: { property: { landlordId } } } });
  if (!lease) throw new HttpError(404, "Lease not found.");
  return lease;
}

// Another active lease on the same room whose dates overlap [start, end] (null end = open-ended).
export async function overlappingLease(
  db: Db,
  { leaseId, roomId, start, end }: { leaseId: string; roomId: string; start: Date; end: Date | null },
) {
  return db.lease.findFirst({
    where: {
      id: { not: leaseId },
      roomId,
      status: "ACTIVE",
      AND: [
        // the other lease hasn't ended before this one starts
        { OR: [{ endDate: null }, { endDate: { gte: start } }] },
        // and this one hasn't ended before the other starts
        ...(end ? [{ startDate: { lte: end } }] : []),
      ],
    },
    include: { tenants: { where: { isPrimary: true }, include: { tenant: { select: { fullName: true } } } } },
  });
}

// Keep the room's listing status in step with its leases.
export async function syncRoomStatus(db: Db, roomId: string) {
  const active = await db.lease.count({ where: { roomId, status: "ACTIVE" } });
  const room = await db.room.findUniqueOrThrow({ where: { id: roomId }, select: { status: true } });
  if (active > 0 && room.status !== "OCCUPIED") {
    await db.room.update({ where: { id: roomId }, data: { status: "OCCUPIED" } });
  } else if (active === 0 && room.status === "OCCUPIED") {
    await db.room.update({ where: { id: roomId }, data: { status: "AVAILABLE" } });
  }
}

export const ROOM_LET_REASON = "This room has been let to another tenant.";

// Once a lease is active, close the room's pending applications whose move-in date falls within
// it: approve the ones from people on the lease, decline the rest. Applications for after a
// fixed-term lease ends stay open.
export async function settleApplications(db: Db, lease: Pick<Lease, "id" | "roomId" | "endDate">) {
  const pending = await db.application.findMany({
    where: {
      roomId: lease.roomId,
      status: "PENDING",
      ...(lease.endDate ? { moveInDate: { lte: lease.endDate } } : {}),
    },
    select: { id: true, applicantId: true },
  });
  if (pending.length === 0) return;
  const onLease = await db.leaseTenant.findMany({
    where: { leaseId: lease.id, tenant: { userId: { in: pending.map((a) => a.applicantId) } } },
    select: { tenant: { select: { id: true, userId: true } } },
  });
  const tenantOf = new Map(onLease.map((lt) => [lt.tenant.userId, lt.tenant.id]));
  const decidedAt = new Date();
  for (const a of pending) {
    const tenantId = tenantOf.get(a.applicantId);
    await db.application.update({
      where: { id: a.id },
      data: tenantId
        ? { status: "APPROVED", decidedAt, tenantId }
        : { status: "REJECTED", decidedAt, declineReason: ROOM_LET_REASON },
    });
  }
}
