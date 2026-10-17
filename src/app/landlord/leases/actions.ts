"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/landlord/ActionForm";
import { issueDepositInvoice, syncBilling, trimInvoicesAfterEnd } from "@/lib/billing";
import { requireRole } from "@/lib/dal";
import { addDays, daysBetween, toISODate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ownedLease, overlappingLease, syncRoomStatus } from "@/lib/leases";
import { endLeaseSchema, fieldsFrom, leaseSchema, type FormState } from "@/lib/validation";

const LEASE_FIELDS = [
  "roomId",
  "primaryTenantId",
  "startDate",
  "endDate",
  "rentAmount",
  "dueDay",
  "depositAmount",
  "graceDays",
  "lateFeeType",
  "lateFeeValue",
  "notes",
];

function revalidateRent() {
  revalidatePath("/landlord", "layout");
}

// Activate a draft: refuse if the room is already let for overlapping dates.
async function activate(leaseId: string): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const lease = await tx.lease.findUniqueOrThrow({ where: { id: leaseId } });
    if (lease.status !== "DRAFT") return "Only a draft lease can be activated.";
    // Lock the room row so two activations for the same room can't both pass the check.
    await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${lease.roomId} FOR UPDATE`;
    const clash = await overlappingLease(tx, {
      leaseId,
      roomId: lease.roomId,
      start: lease.startDate,
      end: lease.endDate,
    });
    if (clash) {
      const who = clash.tenants[0]?.tenant.fullName ?? "another tenant";
      return `This room is already let to ${who} from ${formatDate(clash.startDate)}${
        clash.endDate ? ` to ${formatDate(clash.endDate)}` : ""
      }. End that lease first or change the dates.`;
    }
    const active = await tx.lease.update({ where: { id: leaseId }, data: { status: "ACTIVE" } });
    await syncRoomStatus(tx, lease.roomId);
    await issueDepositInvoice(active, tx);
    return null;
  });
}

export async function saveLease(leaseId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const landlord = await requireRole("LANDLORD");
  const values = fieldsFrom(formData, LEASE_FIELDS);
  const otherTenantIds = formData.getAll("otherTenantIds").map(String);
  const parsed = leaseSchema.safeParse({ ...values, otherTenantIds });
  const echo = { ...values, otherTenantIds: otherTenantIds.join(",") };
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values: echo };
  const { primaryTenantId, otherTenantIds: others, rentAmount, ...terms } = parsed.data;

  if (leaseId) {
    const existing = await ownedLease(leaseId, landlord.id);
    if (existing.status !== "DRAFT") throw new Error("Only a draft lease can be edited");
  }
  const room = await prisma.room.findFirst({ where: { id: terms.roomId, property: { landlordId: landlord.id } } });
  if (!room) return { fieldErrors: { roomId: ["Choose a room."] }, values: echo };

  const tenantIds = [primaryTenantId, ...others.filter((id) => id !== primaryTenantId)];
  const owned = await prisma.tenant.count({ where: { id: { in: tenantIds }, landlordId: landlord.id } });
  if (owned !== tenantIds.length) return { fieldErrors: { primaryTenantId: ["Choose your tenants."] }, values: echo };
  if (tenantIds.length > room.maxOccupants) {
    return {
      fieldErrors: { otherTenantIds: [`${room.name} allows up to ${room.maxOccupants} occupants.`] },
      values: echo,
    };
  }

  const data = { ...terms, rentAmount: rentAmount ?? room.rentPrice };
  const tenants = { create: tenantIds.map((tenantId, i) => ({ tenantId, isPrimary: i === 0 })) };
  const lease = leaseId
    ? await prisma.$transaction(async (tx) => {
        await tx.leaseTenant.deleteMany({ where: { leaseId } });
        return tx.lease.update({ where: { id: leaseId }, data: { ...data, tenants } });
      })
    : await prisma.lease.create({ data: { ...data, tenants } });

  if (formData.get("intent") === "activate") {
    const error = await activate(lease.id);
    if (error) {
      revalidateRent();
      redirect(`/landlord/leases/${lease.id}?error=${encodeURIComponent(error)}`);
    }
    await syncBilling(landlord.id);
  }
  revalidateRent();
  redirect(`/landlord/leases/${lease.id}`);
}

export async function activateLease(leaseId: string): Promise<ActionResult> {
  const landlord = await requireRole("LANDLORD");
  await ownedLease(leaseId, landlord.id);
  const error = await activate(leaseId);
  if (error) return { error };
  await syncBilling(landlord.id);
  revalidateRent();
  return {};
}

export async function endLease(leaseId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const landlord = await requireRole("LANDLORD");
  const lease = await ownedLease(leaseId, landlord.id);
  if (lease.status !== "ACTIVE") return { error: "Only an active lease can be ended." };
  const parsed = endLeaseSchema.safeParse({ endOn: String(formData.get("endOn") ?? "") });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { endOn } = parsed.data;
  if (endOn < lease.startDate) return { error: "The last day can't be before the lease starts." };

  // Ending on or after the agreed end date is a normal end; before it is an early termination.
  const data =
    !lease.endDate
      ? { status: "ENDED" as const, endDate: endOn }
      : endOn >= lease.endDate
        ? { status: "ENDED" as const }
        : { status: "TERMINATED" as const, terminatedOn: endOn };

  await prisma.$transaction(async (tx) => {
    const ended = await tx.lease.update({ where: { id: leaseId }, data });
    await syncRoomStatus(tx, lease.roomId);
    await trimInvoicesAfterEnd(ended, tx);
  });
  await syncBilling(landlord.id);
  revalidateRent();
  return {};
}

// Renewal starts a new draft with the same terms, beginning the day after this lease ends.
export async function renewLease(leaseId: string) {
  const landlord = await requireRole("LANDLORD");
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, room: { property: { landlordId: landlord.id } } },
    include: { tenants: true, renewedBy: { select: { id: true } } },
  });
  if (!lease) throw new Error("Lease not found");
  if (lease.renewedBy) redirect(`/landlord/leases/${lease.renewedBy.id}`);
  const lastDay = lease.terminatedOn ?? lease.endDate;
  if (!lastDay) throw new Error("A month-to-month lease doesn't need renewing");

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
  revalidateRent();
  redirect(`/landlord/leases/${renewal.id}/edit`);
}

export async function deleteLease(leaseId: string) {
  const landlord = await requireRole("LANDLORD");
  const lease = await ownedLease(leaseId, landlord.id);
  if (lease.status !== "DRAFT") throw new Error("Only a draft lease can be deleted");
  await prisma.lease.delete({ where: { id: leaseId } });
  revalidateRent();
  redirect("/landlord/leases");
}
