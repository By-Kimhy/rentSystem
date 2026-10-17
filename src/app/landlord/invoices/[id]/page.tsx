import Link from "next/link";
import { addInvoiceLine, voidInvoice } from "../actions";
import type { InvoiceDetail } from "@api/contract";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { formatDate, formatRent, receiptNumber } from "@/lib/format";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PrintButton } from "@/components/PrintButton";
import { ActionButton, ActionForm } from "@/components/landlord/ActionForm";
import { inputClass } from "@/components/landlord/fields";
import { BackLink, cardClass, primaryButtonClass, secondaryButtonClass } from "@/components/landlord/ui";

export default async function InvoicePage({ params }: PageProps<"/landlord/invoices/[id]">) {
  const { id } = await params;
  await requireRole("LANDLORD");
  const { invoice } = await apiGet<{ invoice: InvoiceDetail }>(`/landlord/invoices/${id}`);
  const { lease } = invoice;
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

      <InvoiceDocument invoice={invoice} />

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
