import Link from "next/link";
import type { InvoiceStatus } from "@prisma/client";
import { syncBilling } from "@/lib/billing";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { InvoiceTable } from "@/components/landlord/InvoiceTable";
import { PageHeader } from "@/components/landlord/ui";

export const metadata = { title: "Invoices · RentSystem" };

const FILTERS: { key: string; label: string; statuses?: InvoiceStatus[] }[] = [
  { key: "", label: "Unpaid", statuses: ["OPEN", "PARTIAL", "OVERDUE"] },
  { key: "overdue", label: "Overdue", statuses: ["OVERDUE"] },
  { key: "paid", label: "Paid", statuses: ["PAID"] },
  { key: "void", label: "Void", statuses: ["VOID"] },
  { key: "all", label: "All" },
];

export default async function InvoicesPage({ searchParams }: PageProps<"/landlord/invoices">) {
  const landlord = await requireRole("LANDLORD");
  await syncBilling(landlord.id);
  const { show: rawShow } = await searchParams;
  const filter = FILTERS.find((f) => f.key === rawShow) ?? FILTERS[0];
  const invoices = await prisma.invoice.findMany({
    where: {
      lease: { room: { property: { landlordId: landlord.id } } },
      ...(filter.statuses ? { status: { in: filter.statuses } } : {}),
    },
    orderBy: [{ dueDate: filter.key === "" || filter.key === "overdue" ? "asc" : "desc" }, { number: "desc" }],
    take: 500,
    include: {
      lease: {
        select: {
          room: { select: { name: true, property: { select: { name: true } } } },
          tenants: { where: { isPrimary: true }, select: { tenant: { select: { fullName: true } } } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Rent invoices are created automatically a week before each due date. Bill a one-off charge from a lease page.
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/landlord/invoices?show=${f.key}` : "/landlord/invoices"}
            className={`rounded-full border px-3 py-1 ${
              filter.key === f.key
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <InvoiceTable
        showTenant
        invoices={invoices.map((i) => ({
          ...i,
          tenantName: i.lease.tenants[0]?.tenant.fullName,
          roomLabel: `${i.lease.room.name}, ${i.lease.room.property.name}`,
        }))}
      />
    </div>
  );
}
