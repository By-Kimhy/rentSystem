"use client";

import { useActionState } from "react";
import { recordPayment } from "@/app/landlord/payments/actions";
import { PAYMENT_METHOD_LABELS } from "@/lib/format";
import { Field, inputClass } from "./fields";
import { SubmitButton } from "./SubmitButton";

export type OpenInvoice = { id: string; label: string; due: string; balance: string };

export function PaymentForm({
  leaseId,
  tenants,
  invoices,
  defaultPayer,
  defaultDate,
  suggestedAmount,
}: {
  leaseId: string;
  tenants: { id: string; name: string }[];
  invoices: OpenInvoice[];
  defaultPayer: string;
  defaultDate: string;
  suggestedAmount: string;
}) {
  const [state, action] = useActionState(recordPayment, {});
  const errors = state.fieldErrors;
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="leaseId" value={leaseId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount received (USD)" name="amount" errors={errors}>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={v.amount ?? suggestedAmount}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Date received" name="paidOn" errors={errors}>
          <input name="paidOn" type="date" defaultValue={v.paidOn ?? defaultDate} required className={inputClass} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Method" name="method" errors={errors}>
          <select key={v.method} name="method" defaultValue={v.method ?? "CASH"} className={inputClass}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Paid by" name="payerTenantId" errors={errors}>
          <select key={v.payerTenantId} name="payerTenantId" defaultValue={v.payerTenantId ?? defaultPayer} className={inputClass}>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Reference (transfer ID, cheque number…)" name="reference" errors={errors}>
        <input name="reference" defaultValue={v.reference} className={inputClass} />
      </Field>
      <Field label="Notes" name="notes" errors={errors}>
        <textarea name="notes" defaultValue={v.notes} rows={2} className={inputClass} />
      </Field>

      {invoices.length > 0 && (
        <details className="rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <summary className="cursor-pointer font-medium">
            Split across invoices (optional; by default the oldest invoice is paid first)
          </summary>
          <table className="mt-3 w-full">
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td className="py-2">
                    {i.label}
                    <div className="text-zinc-500">
                      Due {i.due} · balance {i.balance}
                    </div>
                  </td>
                  <td className="w-36 py-2">
                    <input
                      name={`alloc_${i.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={v[`alloc_${i.id}`] ?? ""}
                      placeholder="auto"
                      aria-label={`Amount for ${i.label}`}
                      className={inputClass}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {errors?.allocations?.[0] && <p className="mt-2 text-red-600">{errors.allocations[0]}</p>}
        </details>
      )}

      <SubmitButton>Save payment</SubmitButton>
    </form>
  );
}
