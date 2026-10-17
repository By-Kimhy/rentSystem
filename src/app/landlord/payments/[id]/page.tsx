import Link from "next/link";
import { notFound } from "next/navigation";
import { reversePayment } from "../actions";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { PAYMENT_METHOD_LABELS, formatDate, formatRent, invoiceNumber, receiptNumber } from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";
import { PrintButton } from "@/components/PrintButton";
import { ActionButton, ActionForm } from "@/components/landlord/ActionForm";
import { invoiceLabel } from "@/components/landlord/InvoiceTable";
import { inputClass } from "@/components/landlord/fields";
import { BackLink, cardClass, secondaryButtonClass } from "@/components/landlord/ui";

export default async function PaymentPage({ params }: PageProps<"/landlord/payments/[id]">) {
  const { id } = await params;
  const landlord = await requireRole("LANDLORD");
  const payment = await prisma.payment.findFirst({
    where: { id, lease: { room: { property: { landlordId: landlord.id } } } },
    include: {
      payer: true,
      receivedBy: { select: { name: true } },
      allocations: { include: { invoice: true }, orderBy: { createdAt: "asc" } },
      reversedBy: { select: { id: true } },
      reversalOf: { select: { id: true } },
      lease: { include: { room: { include: { property: true } } } },
    },
  });
  if (!payment) notFound();
  const allocated = payment.allocations.reduce((s, a) => s + toCents(a.amount), 0);
  const credit = payment.reversedBy || payment.reversalOfId ? 0 : toCents(payment.amount) - allocated;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href={`/landlord/leases/${payment.leaseId}`}>Lease</BackLink>
        <PrintButton className={secondaryButtonClass}>Print receipt</PrintButton>
      </div>

      <article className={`${cardClass} max-w-xl space-y-5 p-6 print:border-0 print:p-0`}>
        <header>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {payment.reversalOfId ? "Payment reversal" : "Payment receipt"}
          </p>
          <h1 className="text-2xl font-semibold">{receiptNumber(payment.id)}</h1>
          {payment.reversedBy && (
            <p className="text-sm text-red-600 dark:text-red-400">
              This payment was reversed.{" "}
              <Link href={`/landlord/payments/${payment.reversedBy.id}`} className="underline print:no-underline">
                See the reversal
              </Link>
            </p>
          )}
        </header>
        <p className="text-3xl font-semibold">{formatRent(payment.amount)}</p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-zinc-500">Received from</dt>
          <dd>{payment.payer?.fullName ?? "—"}</dd>
          <dt className="text-zinc-500">For</dt>
          <dd>
            {payment.lease.room.name}, {payment.lease.room.property.name}
          </dd>
          <dt className="text-zinc-500">Date</dt>
          <dd>{formatDate(payment.paidOn)}</dd>
          <dt className="text-zinc-500">Method</dt>
          <dd>
            {PAYMENT_METHOD_LABELS[payment.method]}
            {payment.reference ? ` · ${payment.reference}` : ""}
          </dd>
          <dt className="text-zinc-500">Received by</dt>
          <dd>{payment.receivedBy.name}</dd>
        </dl>
        {payment.allocations.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left dark:border-zinc-800">
              <tr>
                <th className="py-2 font-medium">Applied to</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {payment.allocations.map((a) => (
                <tr key={a.id}>
                  <td className="py-2">
                    <Link href={`/landlord/invoices/${a.invoiceId}`} className="hover:underline print:no-underline">
                      {invoiceNumber(a.invoice.number)}
                    </Link>{" "}
                    · {invoiceLabel(a.invoice)}
                  </td>
                  <td className="py-2 text-right">{formatRent(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {credit > 0 && (
          <p className="text-sm">{formatRent(Number(fromCents(credit)))} kept as credit toward the next invoice.</p>
        )}
        {payment.notes && <p className="text-sm text-zinc-600 dark:text-zinc-400">{payment.notes}</p>}
      </article>

      {!payment.reversalOfId && !payment.reversedBy && (
        <details className={`${cardClass} max-w-xl p-4 print:hidden`}>
          <summary className="cursor-pointer text-sm font-medium text-red-600 dark:text-red-400">
            Reverse this payment
          </summary>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Use this if the payment was entered by mistake or bounced. It records a matching negative entry and puts
            the invoices back to unpaid.
          </p>
          <ActionForm
            action={reversePayment.bind(null, payment.id)}
            confirmMessage="Reverse this payment?"
            className="mt-3 space-y-3"
          >
            <input name="reason" required placeholder="Reason" className={inputClass} />
            <ActionButton className={secondaryButtonClass}>Reverse payment</ActionButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
