import Link from "next/link";
import type { LeaseStatus } from "@prisma/client";
import { requireRole } from "@/lib/dal";
import { addDays, today } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { LEASE_STATUS_LABELS, LEASE_STATUS_STYLES, formatDate, formatRent } from "@/lib/format";
import {
  Badge,
  EmptyState,
  PageHeader,
  cardClass,
  primaryButtonClass,
  tableClass,
  tdClass,
  thClass,
} from "@/components/landlord/ui";

export const metadata = { title: "Leases · RentSystem" };

const FILTERS = [
  { key: "", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "ending", label: "Ending in 60 days" },
  { key: "DRAFT", label: "Drafts" },
  { key: "past", label: "Ended" },
];

export default async function LeasesPage({ searchParams }: PageProps<"/landlord/leases">) {
  const landlord = await requireRole("LANDLORD");
  const { show: rawShow } = await searchParams;
  const show = typeof rawShow === "string" ? rawShow : "";
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
    where: { room: { property: { landlordId: landlord.id } }, ...statusFilter },
    orderBy: [{ startDate: "desc" }],
    include: {
      room: { select: { name: true, property: { select: { name: true } } } },
      tenants: { include: { tenant: { select: { fullName: true } } }, orderBy: { isPrimary: "desc" } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Leases">
        <Link href="/landlord/leases/new" className={primaryButtonClass}>
          New lease
        </Link>
      </PageHeader>

      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/landlord/leases?show=${f.key}` : "/landlord/leases"}
            className={`rounded-full border px-3 py-1 ${
              show === f.key
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {leases.length === 0 ? (
        <EmptyState>No leases here yet.</EmptyState>
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className={tableClass}>
            <thead className="border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className={thClass}>Room</th>
                <th className={thClass}>Tenants</th>
                <th className={thClass}>Term</th>
                <th className={`${thClass} text-right`}>Rent</th>
                <th className={`${thClass} text-right`}>Deposit</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {leases.map((lease) => (
                <tr key={lease.id}>
                  <td className={tdClass}>
                    <Link href={`/landlord/leases/${lease.id}`} className="font-medium hover:underline">
                      {lease.room.name}
                    </Link>
                    <div className="text-zinc-500">{lease.room.property.name}</div>
                  </td>
                  <td className={tdClass}>{lease.tenants.map((t) => t.tenant.fullName).join(", ")}</td>
                  <td className={tdClass}>
                    {formatDate(lease.startDate)}
                    <div className="text-zinc-500">
                      to {lease.terminatedOn ? formatDate(lease.terminatedOn) : lease.endDate ? formatDate(lease.endDate) : "month-to-month"}
                    </div>
                  </td>
                  <td className={`${tdClass} text-right`}>{formatRent(lease.rentAmount)}</td>
                  <td className={`${tdClass} text-right`}>{formatRent(lease.depositAmount)}</td>
                  <td className={tdClass}>
                    <Badge className={LEASE_STATUS_STYLES[lease.status]}>{LEASE_STATUS_LABELS[lease.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
