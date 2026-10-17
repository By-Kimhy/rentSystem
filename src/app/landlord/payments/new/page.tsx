import { invoiceLabel } from "@/components/landlord/InvoiceTable";
import { PaymentForm } from "@/components/landlord/PaymentForm";
import { inputClass } from "@/components/landlord/fields";
import { BackLink, EmptyState, secondaryButtonClass } from "@/components/landlord/ui";
import type { PaymentOptions } from "@api/contract";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { today, toISODate } from "@/lib/dates";
import { formatDate, formatRent } from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";

export const metadata = { title: "Record payment · RentSystem" };

export default async function NewPaymentPage({ searchParams }: PageProps<"/landlord/payments/new">) {
  await requireRole("LANDLORD");
  const { lease: rawLease } = await searchParams;
  const leaseId = typeof rawLease === "string" ? rawLease : "";

  const { leases, invoices } = await apiGet<PaymentOptions>("/landlord/payments/options", { lease: leaseId });
  const lease = leases.find((l) => l.id === leaseId);
  const leaseName = (l: (typeof leases)[number]) =>
    `${l.tenants[0]?.tenant.fullName ?? "?"} · ${l.room.name}, ${l.room.property.name}${l.status === "ACTIVE" ? "" : " (ended)"}`;

  const owed = invoices.reduce((s, i) => s + toCents(i.total) - toCents(i.amountPaid), 0);

  return (
    <div className="max-w-2xl space-y-6">
      <BackLink href={lease ? `/landlord/leases/${lease.id}` : "/landlord/payments"}>{lease ? "Lease" : "Payments"}</BackLink>
      <h1 className="text-2xl font-semibold">Record payment</h1>

      {leases.length === 0 ? (
        <EmptyState>Activate a lease before recording payments.</EmptyState>
      ) : (
        <form className="flex gap-2">
          <select name="lease" defaultValue={leaseId} required className={`${inputClass} mt-0`} aria-label="Lease">
            <option value="">Choose a tenant and lease…</option>
            {leases.map((l) => (
              <option key={l.id} value={l.id}>
                {leaseName(l)}
              </option>
            ))}
          </select>
          <button type="submit" className={secondaryButtonClass}>
            Choose
          </button>
        </form>
      )}

      {lease && (
        <>
          <p className="text-zinc-600 dark:text-zinc-400">
            {invoices.length === 0
              ? "Nothing is owed on this lease right now. The payment will be kept as credit for the next invoice."
              : `${invoices.length} unpaid ${invoices.length === 1 ? "invoice" : "invoices"}, ${formatRent(Number(fromCents(owed)))} owed in total.`}
          </p>
          <PaymentForm
            key={lease.id}
            leaseId={lease.id}
            tenants={lease.tenants.map((t) => ({ id: t.tenant.id, name: t.tenant.fullName }))}
            defaultPayer={lease.tenants[0]?.tenant.id ?? ""}
            defaultDate={toISODate(today())}
            suggestedAmount={owed > 0 ? fromCents(owed) : ""}
            invoices={invoices.map((i) => ({
              id: i.id,
              label: invoiceLabel(i),
              due: formatDate(i.dueDate),
              balance: formatRent(Number(fromCents(toCents(i.total) - toCents(i.amountPaid)))),
            }))}
          />
        </>
      )}
    </div>
  );
}
