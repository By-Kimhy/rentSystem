"use client";

import { useActionState } from "react";
import { reportPayment, type ReportState } from "@/app/tenant/actions";
import { PAYMENT_METHOD_LABELS } from "@/lib/format";
import { Field, inputClass } from "@/components/landlord/fields";
import { SubmitButton } from "@/components/landlord/SubmitButton";

export function ReportPaymentForm({
  leases,
  defaultAmount,
  today,
}: {
  leases: { id: string; label: string }[];
  defaultAmount: string;
  // YYYY-MM-DD, the latest allowed payment date.
  today: string;
}) {
  const [state, action] = useActionState<ReportState, FormData>(reportPayment, {});
  const errors = state.fieldErrors;
  const v = state.values ?? {
    leaseId: leases[0]?.id ?? "",
    amount: defaultAmount,
    method: "BANK",
    paidOn: today,
    reference: "",
    note: "",
  };

  return (
    // A new key after each report clears the form.
    <form key={state.sent ?? "form"} action={action} className="space-y-4">
      {state.sent && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          Sent. Your landlord will confirm it once they see the money.
        </p>
      )}
      {errors?.form && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errors.form[0]}
        </p>
      )}
      {leases.length > 1 ? (
        <Field label="Lease" name="leaseId" errors={errors}>
          <select name="leaseId" defaultValue={v.leaseId} className={inputClass}>
            {leases.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="leaseId" value={v.leaseId} />
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Amount (USD)" name="amount" errors={errors}>
          <input name="amount" type="number" step="0.01" min="0.01" defaultValue={v.amount} required className={inputClass} />
        </Field>
        <Field label="How you paid" name="method" errors={errors}>
          <select name="method" defaultValue={v.method} className={inputClass}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date paid" name="paidOn" errors={errors}>
          <input name="paidOn" type="date" max={today} defaultValue={v.paidOn} required className={inputClass} />
        </Field>
      </div>
      <Field label="Reference (optional)" name="reference" errors={errors}>
        <input name="reference" defaultValue={v.reference} placeholder="Transfer or receipt number" className={inputClass} />
      </Field>
      <Field label="Note (optional)" name="note" errors={errors}>
        <textarea name="note" rows={2} defaultValue={v.note} className={inputClass} />
      </Field>
      <SubmitButton>Send to landlord</SubmitButton>
    </form>
  );
}
