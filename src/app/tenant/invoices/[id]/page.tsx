import { cache } from "react";
import type { TenantInvoice } from "@api/contract";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { formatDate, formatRent, invoiceNumber, receiptNumber } from "@/lib/format";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PrintButton } from "@/components/PrintButton";
import { BackLink, cardClass, secondaryButtonClass } from "@/components/landlord/ui";

// Shared by generateMetadata and the page, so the invoice is fetched once per request.
const getInvoice = cache((id: string) => apiGet<{ invoice: TenantInvoice }>(`/tenant/invoices/${id}`));

export async function generateMetadata({ params }: PageProps<"/tenant/invoices/[id]">) {
  const { id } = await params;
  const { invoice } = await getInvoice(id);
  return { title: `${invoiceNumber(invoice.number)} · RentSystem` };
}

export default async function TenantInvoicePage({ params }: PageProps<"/tenant/invoices/[id]">) {
  const { id } = await params;
  await requireRole("TENANT");
  const { invoice } = await getInvoice(id);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href="/tenant">Dashboard</BackLink>
        <PrintButton className={secondaryButtonClass}>Print or save PDF</PrintButton>
      </div>

      <InvoiceDocument invoice={invoice} />

      {invoice.allocations.length > 0 && (
        <section className="space-y-3 print:hidden">
          <h2 className="text-lg font-semibold">Payments applied</h2>
          <ul className={`${cardClass} divide-y divide-zinc-200 text-sm dark:divide-zinc-800`}>
            {invoice.allocations.map((a) => (
              <li key={a.id} className="flex justify-between p-3">
                <span>
                  {formatDate(a.payment.paidOn)} · {receiptNumber(a.paymentId)}
                  {a.payment.reversalOfId ? " (reversal)" : ""}
                </span>
                <span>{formatRent(a.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
