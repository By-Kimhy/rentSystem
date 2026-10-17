import type { Prisma } from "@prisma/client";
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
