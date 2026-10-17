"use client";

import { useActionState } from "react";
import type { Property } from "@prisma/client";
import { saveProperty } from "@/app/landlord/properties/actions";
import { PROPERTY_TYPE_LABELS } from "@/lib/format";
import { Field, PhotoInput, inputClass } from "./fields";
import { SubmitButton } from "./SubmitButton";

export function PropertyForm({ property }: { property?: Property }) {
  const [state, action] = useActionState(saveProperty.bind(null, property?.id ?? null), {});
  const errors = state.fieldErrors;
  const v = state.values ?? {
    name: property?.name ?? "",
    type: property?.type ?? "APARTMENT",
    address: property?.address ?? "",
    city: property?.city ?? "",
    description: property?.description ?? "",
  };
  return (
    <form action={action} className="space-y-4">
      <Field label="Name" name="name" errors={errors}>
        <input name="name" defaultValue={v.name} required className={inputClass} />
      </Field>
      <Field label="Type" name="type" errors={errors}>
        {/* keyed: React won't re-apply a select's defaultValue when the form resets */}
        <select key={v.type} name="type" defaultValue={v.type} className={inputClass}>
          {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Address" name="address" errors={errors}>
        <input name="address" defaultValue={v.address} required className={inputClass} />
      </Field>
      <Field label="City" name="city" errors={errors}>
        <input name="city" defaultValue={v.city} required className={inputClass} />
      </Field>
      <Field label="Description" name="description" errors={errors}>
        <textarea name="description" defaultValue={v.description} rows={4} className={inputClass} />
      </Field>
      <PhotoInput errors={errors} />
      <SubmitButton>{property ? "Save changes" : "Create property"}</SubmitButton>
    </form>
  );
}
