import type { TenantInvoice } from "@api/contract";
import { daysOverdue } from "@/lib/dates";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_STYLES, formatDate, formatRent, invoiceNumber } from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";
import { invoiceLabel } from "@/components/landlord/InvoiceTable";
import { Badge, cardClass } from "@/components/landlord/ui";

// The printable invoice, shared by the landlord's and the tenant's invoice pages. Typed with
// the tenant's (smaller) shape, which the landlord's invoice also satisfies.
export function InvoiceDocument({ invoice }: { invoice: TenantInvoice }) {
  const { lease } = invoice;
  const tenant = lease.tenants[0]?.tenant;
  const balance = invoice.status === "VOID" ? 0 : toCents(invoice.total) - toCents(invoice.amountPaid);

  return (
    <article className={`${cardClass} space-y-6 p-6 print:border-0 print:p-0`}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Invoice</p>
          <h1 className="text-2xl font-semibold">{invoiceNumber(invoice.number)}</h1>
          <p className="text-zinc-600 dark:text-zinc-400">{invoiceLabel(invoice)}</p>
        </div>
        <Badge className={INVOICE_STATUS_STYLES[invoice.status]}>{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
      </header>

      <div className="grid gap-6 text-sm sm:grid-cols-3">
        <div>
          <p className="font-medium">From</p>
          <p>{lease.room.property.landlord.name}</p>
          <p className="text-zinc-500">{lease.room.property.landlord.email}</p>
        </div>
        <div>
          <p className="font-medium">Billed to</p>
          <p>{tenant?.fullName}</p>
          <p className="text-zinc-500">
            {lease.room.name}, {lease.room.property.name}
            <br />
            {lease.room.property.address}, {lease.room.property.city}
          </p>
        </div>
        <div>
          <p>
            <span className="font-medium">Issued:</span> {formatDate(invoice.issueDate)}
          </p>
          <p>
            <span className="font-medium">Due:</span> {formatDate(invoice.dueDate)}
          </p>
          {invoice.status === "OVERDUE" && (
            <p className="text-red-600 dark:text-red-400">{daysOverdue(invoice.dueDate)} days overdue</p>
          )}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="border-b border-zinc-200 text-left dark:border-zinc-800">
          <tr>
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {invoice.lines.map((line) => (
            <tr key={line.id}>
              <td className="py-2">{line.description}</td>
              <td className="py-2 text-right">{formatRent(line.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-zinc-300 dark:border-zinc-700">
          <tr>
            <td className="py-2 font-medium">Total</td>
            <td className="py-2 text-right font-medium">{formatRent(invoice.total)}</td>
          </tr>
          <tr>
            <td className="py-1 text-zinc-500">Paid</td>
            <td className="py-1 text-right text-zinc-500">{formatRent(invoice.amountPaid)}</td>
          </tr>
          <tr>
            <td className="py-1 font-semibold">Balance due</td>
            <td className="py-1 text-right font-semibold">{formatRent(Number(fromCents(balance)))}</td>
          </tr>
        </tfoot>
      </table>

      {invoice.status === "VOID" && <p className="text-sm text-zinc-500">Voided: {invoice.voidReason}</p>}
    </article>
  );
}
