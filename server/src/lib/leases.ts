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

// Once a lease is active, close the room's open applications from anyone whose stay would
// overlap it (moving in before it ends): approve pending ones from people on the lease, and
// decline the rest, including earlier approvals for people the landlord didn't put on it.
// Applications to move in after a fixed-term lease ends stay as they are.
export async function settleApplications(db: Db, lease: Pick<Lease, "id" | "roomId" | "endDate">) {
  const open = await db.application.findMany({
    where: {
      roomId: lease.roomId,
      status: { in: ["PENDING", "APPROVED"] },
      ...(lease.endDate ? { moveInDate: { lte: lease.endDate } } : {}),
    },
    select: { id: true, applicantId: true, status: true },
  });
  if (open.length === 0) return;
  const onLease = await db.leaseTenant.findMany({
    where: { leaseId: lease.id, tenant: { userId: { in: open.map((a) => a.applicantId) } } },
    select: { tenant: { select: { id: true, userId: true } } },
  });
  const tenantOf = new Map(onLease.map((lt) => [lt.tenant.userId, lt.tenant.id]));
  const decidedAt = new Date();

  // People on the lease: pending applications become approved (already-approved ones stay).
  for (const a of open.filter((a) => a.status === "PENDING" && tenantOf.has(a.applicantId))) {
    await db.application.update({
      where: { id: a.id },
      data: { status: "APPROVED", decidedAt, tenantId: tenantOf.get(a.applicantId) },
    });
  }
  const declined = open.filter((a) => !tenantOf.has(a.applicantId)).map((a) => a.id);
  if (declined.length > 0) {
    await db.application.updateMany({
      where: { id: { in: declined } },
      data: { status: "REJECTED", decidedAt, declineReason: ROOM_LET_REASON },
    });
  }
}
