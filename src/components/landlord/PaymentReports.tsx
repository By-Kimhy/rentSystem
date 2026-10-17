import type { PaymentReportItem } from "@api/contract";
import { confirmPaymentReport, rejectPaymentReport } from "@/app/landlord/payments/actions";
import { PAYMENT_METHOD_LABELS, formatDate, formatRent } from "@/lib/format";
import { ActionButton, ActionForm } from "./ActionForm";
import { inputClass } from "./fields";
import { cardClass, primaryButtonClass, secondaryButtonClass } from "./ui";

// Payments tenants say they made, waiting for the landlord to check them against the money received.
export function PaymentReports({ reports }: { reports: PaymentReportItem[] }) {
  if (reports.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Reported by tenants</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Check each one against what you received. Confirming records it as a payment and applies it to the oldest unpaid
        invoices.
      </p>
      <ul className="space-y-3">
        {reports.map((r) => (
          <li key={r.id} className={`${cardClass} space-y-3 p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {formatRent(r.amount)} · {PAYMENT_METHOD_LABELS[r.method]}
                  {r.reference && <span className="font-normal text-zinc-500"> · {r.reference}</span>}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {r.reporter.name}, {r.lease.room.name}, {r.lease.room.property.name} · paid {formatDate(r.paidOn)} ·
                  reported {formatDate(r.createdAt)}
                </p>
                {r.note && <p className="mt-1 whitespace-pre-line text-sm">“{r.note}”</p>}
              </div>
              <ActionForm action={confirmPaymentReport.bind(null, r.id)}>
                <ActionButton className={primaryButtonClass}>Confirm payment</ActionButton>
              </ActionForm>
            </div>
            <details>
              <summary className="cursor-pointer text-sm text-red-600 dark:text-red-400">Reject</summary>
              <ActionForm action={rejectPaymentReport.bind(null, r.id)} className="mt-2 flex flex-wrap gap-2">
                <input
                  name="reason"
                  required
                  maxLength={255}
                  placeholder="Why, e.g. nothing arrived in the account"
                  className={`${inputClass} mt-0 flex-1`}
                />
                <ActionButton className={secondaryButtonClass}>Reject report</ActionButton>
              </ActionForm>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
