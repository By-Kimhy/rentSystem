"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveLease } from "@/app/landlord/leases/actions";
import { LATE_FEE_LABELS } from "@/lib/format";
import { Field, inputClass } from "./fields";
import { primaryButtonClass, secondaryButtonClass } from "./ui";

export type LeaseFormValues = {
  roomId: string;
  primaryTenantId: string;
  otherTenantIds: string;
  startDate: string;
  endDate: string;
  rentAmount: string;
  dueDay: string;
  depositAmount: string;
  graceDays: string;
  lateFeeType: string;
  lateFeeValue: string;
  notes: string;
};

export type RoomOption = { id: string; label: string; rent: string; status: string };
export type PropertyRooms = { property: string; rooms: RoomOption[] };
export type TenantOption = { id: string; name: string };

function Buttons({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-3">
      <button type="submit" name="intent" value="activate" disabled={pending} className={primaryButtonClass}>
        {pending ? "Saving…" : "Save and activate"}
      </button>
      <button type="submit" name="intent" value="draft" disabled={pending} className={secondaryButtonClass}>
        {isNew ? "Save as draft" : "Save draft"}
      </button>
    </div>
  );
}

export function LeaseForm({
  leaseId,
  initial,
  properties,
  tenants,
}: {
  leaseId?: string;
  initial: LeaseFormValues;
  properties: PropertyRooms[];
  tenants: TenantOption[];
}) {
  const [state, action] = useActionState(saveLease.bind(null, leaseId ?? null), {});
  const errors = state.fieldErrors;
  const v = (state.values as LeaseFormValues | undefined) ?? initial;
  const others = new Set(v.otherTenantIds.split(",").filter(Boolean));

  return (
    <form action={action} className="space-y-8">
      <fieldset className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">1. Room</legend>
        <Field label="Room" name="roomId" errors={errors}>
          <select key={v.roomId} name="roomId" defaultValue={v.roomId} required className={inputClass}>
            <option value="">Choose a room…</option>
            {properties.map((p) => (
              <optgroup key={p.property} label={p.property}>
                {p.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} · {r.rent} / month{r.status === "AVAILABLE" ? "" : ` · ${r.status.toLowerCase()}`}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">2. Tenants</legend>
        <Field label="Primary tenant (receives the invoices)" name="primaryTenantId" errors={errors}>
          <select key={v.primaryTenantId} name="primaryTenantId" defaultValue={v.primaryTenantId} required className={inputClass}>
            <option value="">Choose a tenant…</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        {tenants.length > 1 && (
          <div className="text-sm">
            <p className="font-medium">Roommates on the same lease (optional)</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2" key={v.otherTenantIds}>
              {tenants.map((t) => (
                <label key={t.id} className="flex items-center gap-2">
                  <input type="checkbox" name="otherTenantIds" value={t.id} defaultChecked={others.has(t.id)} />
                  {t.name}
                </label>
              ))}
            </div>
            {errors?.otherTenantIds?.[0] && <p className="mt-1 text-red-600">{errors.otherTenantIds[0]}</p>}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">3. Terms</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" name="startDate" errors={errors}>
            <input name="startDate" type="date" defaultValue={v.startDate} required className={inputClass} />
          </Field>
          <Field label="End date (leave blank for month-to-month)" name="endDate" errors={errors}>
            <input name="endDate" type="date" defaultValue={v.endDate} className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Monthly rent (USD, blank = room's rent)" name="rentAmount" errors={errors}>
            <input name="rentAmount" type="number" step="0.01" min="0.01" defaultValue={v.rentAmount} className={inputClass} />
          </Field>
          <Field label="Rent due on day (1 to 28)" name="dueDay" errors={errors}>
            <input name="dueDay" type="number" min="1" max="28" defaultValue={v.dueDay} required className={inputClass} />
          </Field>
          <Field label="Security deposit (USD)" name="depositAmount" errors={errors}>
            <input name="depositAmount" type="number" step="0.01" min="0" defaultValue={v.depositAmount} required className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Grace days before overdue" name="graceDays" errors={errors}>
            <input name="graceDays" type="number" min="0" max="60" defaultValue={v.graceDays} required className={inputClass} />
          </Field>
          <Field label="Late fee" name="lateFeeType" errors={errors}>
            <select key={v.lateFeeType} name="lateFeeType" defaultValue={v.lateFeeType} className={inputClass}>
              {Object.entries(LATE_FEE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Late fee amount (USD or %)" name="lateFeeValue" errors={errors}>
            <input name="lateFeeValue" type="number" step="0.01" min="0" defaultValue={v.lateFeeValue} className={inputClass} />
          </Field>
        </div>
        <Field label="Notes" name="notes" errors={errors}>
          <textarea name="notes" defaultValue={v.notes} rows={3} className={inputClass} />
        </Field>
      </fieldset>

      <Buttons isNew={!leaseId} />
    </form>
  );
}
