"use client";

import { useActionState } from "react";
import { saveRoom } from "@/app/landlord/properties/actions";
import { ROOM_STATUS_LABELS } from "@/lib/format";
import { Field, PhotoInput, inputClass } from "./fields";
import { SubmitButton } from "./SubmitButton";

// Decimal and Date fields arrive pre-formatted as strings so the room can cross to the client.
export type RoomFormValues = {
  id: string;
  name: string;
  rentPrice: string;
  sizeSqm: string;
  maxOccupants: string;
  status: string;
  availableFrom: string;
  description: string;
};

export function RoomForm({ propertyId, room }: { propertyId: string; room?: RoomFormValues }) {
  const [state, action] = useActionState(saveRoom.bind(null, propertyId, room?.id ?? null), {});
  const errors = state.fieldErrors;
  const v = state.values ?? {
    name: room?.name ?? "",
    rentPrice: room?.rentPrice ?? "",
    sizeSqm: room?.sizeSqm ?? "",
    maxOccupants: room?.maxOccupants ?? "1",
    status: room?.status ?? "AVAILABLE",
    availableFrom: room?.availableFrom ?? "",
    description: room?.description ?? "",
  };
  return (
    <form action={action} className="space-y-4">
      <Field label="Room name or number" name="name" errors={errors}>
        <input name="name" defaultValue={v.name} required className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Monthly rent (USD)" name="rentPrice" errors={errors}>
          <input
            name="rentPrice"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={v.rentPrice}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Size (m²)" name="sizeSqm" errors={errors}>
          <input name="sizeSqm" type="number" step="0.01" min="0" defaultValue={v.sizeSqm} className={inputClass} />
        </Field>
        <Field label="Max occupants" name="maxOccupants" errors={errors}>
          <input
            name="maxOccupants"
            type="number"
            min="1"
            defaultValue={v.maxOccupants}
            required
            className={inputClass}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Availability" name="status" errors={errors}>
          {/* keyed: React won't re-apply a select's defaultValue when the form resets */}
          <select key={v.status} name="status" defaultValue={v.status} className={inputClass}>
            {Object.entries(ROOM_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Available from" name="availableFrom" errors={errors}>
          <input name="availableFrom" type="date" defaultValue={v.availableFrom} className={inputClass} />
        </Field>
      </div>
      <Field label="Description" name="description" errors={errors}>
        <textarea name="description" defaultValue={v.description} rows={3} className={inputClass} />
      </Field>
      <PhotoInput errors={errors} />
      <SubmitButton>{room ? "Save room" : "Add room"}</SubmitButton>
    </form>
  );
}
