import Link from "next/link";
import { addInvoiceLine, voidInvoice } from "../actions";
import type { InvoiceDetail } from "@api/contract";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { daysOverdue } from "@/lib/dates";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_STYLES,
  formatDate,
  formatRent,
  invoiceNumber,
  receiptNumber,
} from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";
import { PrintButton } from "@/components/PrintButton";
import { ActionButton, ActionForm } from "@/components/landlord/ActionForm";
import { invoiceLabel } from "@/components/landlord/InvoiceTable";
import { inputClass } from "@/components/landlord/fields";
import { Badge, BackLink, cardClass, primaryButtonClass, secondaryButtonClass } from "@/components/landlord/ui";

export default async function InvoicePage({ params }: PageProps<"/landlord/invoices/[id]">) {
  const { id } = await params;
  await requireRole("LANDLORD");
  const { invoice } = await apiGet<{ invoice: InvoiceDetail }>(`/landlord/invoices/${id}`);
  const { lease } = invoice;
  const tenant = lease.tenants[0]?.tenant;
  const balance = invoice.status === "VOID" ? 0 : toCents(invoice.total) - toCents(invoice.amountPaid);
  const open = ["OPEN", "PARTIAL", "OVERDUE"].includes(invoice.status);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href={`/landlord/leases/${lease.id}`}>Lease</BackLink>
        <div className="flex gap-3">
          {open && (
            <Link href={`/landlord/payments/new?lease=${lease.id}`} className={primaryButtonClass}>
              Record payment
            </Link>
          )}
          <PrintButton className={secondaryButtonClass}>Print or save PDF</PrintButton>
        </div>
      </div>

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

      {invoice.allocations.length > 0 && (
        <section className="space-y-3 print:hidden">
          <h2 className="text-lg font-semibold">Payments applied</h2>
          <ul className={`${cardClass} divide-y divide-zinc-200 text-sm dark:divide-zinc-800`}>
            {invoice.allocations.map((a) => (
              <li key={a.id} className="flex justify-between p-3">
                <Link href={`/landlord/payments/${a.paymentId}`} className="hover:underline">
                  {formatDate(a.payment.paidOn)} · {receiptNumber(a.paymentId)}
                  {a.payment.reversalOfId ? " (reversal)" : ""}
                </Link>
                <span>{formatRent(a.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && (
        <section className="grid gap-4 sm:grid-cols-2 print:hidden">
          <details className={`${cardClass} p-4`}>
            <summary className="cursor-pointer text-sm font-medium">Add a line</summary>
            <ActionForm action={addInvoiceLine.bind(null, invoice.id)} className="mt-4 space-y-3">
              <select name="kind" defaultValue="OTHER" className={inputClass}>
                <option value="UTILITY">Utility</option>
                <option value="OTHER">Other</option>
              </select>
              <input name="description" required placeholder="Description" className={inputClass} />
              <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Amount (USD)" className={inputClass} />
              <ActionButton className={secondaryButtonClass}>Add line</ActionButton>
            </ActionForm>
          </details>
          {invoice.allocations.length === 0 && (
            <details className={`${cardClass} p-4`}>
              <summary className="cursor-pointer text-sm font-medium text-red-600 dark:text-red-400">Void invoice</summary>
              <ActionForm
                action={voidInvoice.bind(null, invoice.id)}
                confirmMessage="Void this invoice? It will no longer be owed."
                className="mt-4 space-y-3"
              >
                <input name="reason" required placeholder="Reason" className={inputClass} />
                <ActionButton className={secondaryButtonClass}>Void invoice</ActionButton>
              </ActionForm>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
