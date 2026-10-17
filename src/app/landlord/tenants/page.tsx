import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { TENANT_STATUS_STYLES, formatRent, tenantStatus } from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";
import { inputClass } from "@/components/landlord/fields";
import {
  Badge,
  EmptyState,
  PageHeader,
  cardClass,
  primaryButtonClass,
  secondaryButtonClass,
  tableClass,
  tdClass,
  thClass,
} from "@/components/landlord/ui";

export const metadata = { title: "Tenants · RentSystem" };

export default async function TenantsPage({ searchParams }: PageProps<"/landlord/tenants">) {
  const landlord = await requireRole("LANDLORD");
  const { q: rawQ } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim() : "";
  const tenants = await prisma.tenant.findMany({
    where: {
      landlordId: landlord.id,
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { fullName: "asc" },
    include: {
      leases: {
        include: {
          lease: {
            select: {
              status: true,
              room: { select: { name: true, property: { select: { name: true } } } },
              invoices: { where: { status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } }, select: { total: true, amountPaid: true } },
            },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants">
        <Link href="/landlord/tenants/new" className={primaryButtonClass}>
          Add tenant
        </Link>
      </PageHeader>

      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search by name, phone or email" className={`${inputClass} mt-0`} />
        <button type="submit" className={secondaryButtonClass}>
          Search
        </button>
      </form>

      {tenants.length === 0 ? (
        <EmptyState>{q ? "No tenants match your search." : "You haven't added any tenants yet."}</EmptyState>
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className={tableClass}>
            <thead className="border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Phone</th>
                <th className={thClass}>Current room</th>
                <th className={thClass}>Balance owed</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {tenants.map((tenant) => {
                const status = tenantStatus(tenant.leases.map((l) => l.lease.status));
                const active = tenant.leases.find((l) => l.lease.status === "ACTIVE")?.lease;
                const owed = tenant.leases
                  .flatMap((l) => l.lease.invoices)
                  .reduce((s, i) => s + toCents(i.total) - toCents(i.amountPaid), 0);
                return (
                  <tr key={tenant.id}>
                    <td className={tdClass}>
                      <Link href={`/landlord/tenants/${tenant.id}`} className="font-medium hover:underline">
                        {tenant.fullName}
                      </Link>
                    </td>
                    <td className={tdClass}>{tenant.phone}</td>
                    <td className={tdClass}>{active ? `${active.room.name}, ${active.room.property.name}` : "—"}</td>
                    <td className={tdClass}>{owed > 0 ? formatRent(Number(fromCents(owed))) : "—"}</td>
                    <td className={tdClass}>
                      <Badge className={TENANT_STATUS_STYLES[status]}>{status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
