import Link from "next/link";
import type { InvoiceListItem } from "@api/contract";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { InvoiceTable } from "@/components/landlord/InvoiceTable";
import { PageHeader } from "@/components/landlord/ui";

export const metadata = { title: "Invoices · RentSystem" };

const FILTERS = [
  { key: "", label: "Unpaid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "void", label: "Void" },
  { key: "all", label: "All" },
];

export default async function InvoicesPage({ searchParams }: PageProps<"/landlord/invoices">) {
  await requireRole("LANDLORD");
  const { show: rawShow } = await searchParams;
  const filter = FILTERS.find((f) => f.key === rawShow) ?? FILTERS[0];
  const { invoices } = await apiGet<{ invoices: InvoiceListItem[] }>("/landlord/invoices", { show: filter.key });

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
