"use client";

import { useActionState } from "react";
import { saveTenant } from "@/app/landlord/tenants/actions";
import { Field, inputClass } from "./fields";
import { SubmitButton } from "./SubmitButton";

export type TenantFormValues = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  idDocType: string;
  idDocNumber: string;
  emergencyContact: string;
  notes: string;
};

export function TenantForm({ tenant }: { tenant?: TenantFormValues }) {
  const [state, action] = useActionState(saveTenant.bind(null, tenant?.id ?? null), {});
  const errors = state.fieldErrors;
  const v = state.values ?? {
    fullName: tenant?.fullName ?? "",
    phone: tenant?.phone ?? "",
    email: tenant?.email ?? "",
    idDocType: tenant?.idDocType ?? "",
    idDocNumber: tenant?.idDocNumber ?? "",
    emergencyContact: tenant?.emergencyContact ?? "",
    notes: tenant?.notes ?? "",
  };
  return (
    <form action={action} className="space-y-4">
      <Field label="Full name" name="fullName" errors={errors}>
        <input name="fullName" defaultValue={v.fullName} required className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" name="phone" errors={errors}>
          <input name="phone" type="tel" defaultValue={v.phone} required className={inputClass} />
        </Field>
        <Field label="Email (optional)" name="email" errors={errors}>
          <input name="email" type="email" defaultValue={v.email} className={inputClass} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ID document type (e.g. National ID, Passport)" name="idDocType" errors={errors}>
          <input name="idDocType" defaultValue={v.idDocType} className={inputClass} />
        </Field>
        <Field label="ID document number" name="idDocNumber" errors={errors}>
          <input name="idDocNumber" defaultValue={v.idDocNumber} className={inputClass} />
        </Field>
      </div>
      <Field label="Emergency contact (name and phone)" name="emergencyContact" errors={errors}>
        <input name="emergencyContact" defaultValue={v.emergencyContact} className={inputClass} />
      </Field>
      <Field label="Notes" name="notes" errors={errors}>
        <textarea name="notes" defaultValue={v.notes} rows={3} className={inputClass} />
      </Field>
      <SubmitButton>{tenant ? "Save tenant" : "Add tenant"}</SubmitButton>
    </form>
  );
}
