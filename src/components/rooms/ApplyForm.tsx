"use client";

import { useActionState } from "react";
import { applyForRoom } from "@/app/rooms/actions";
import { Field, inputClass } from "@/components/landlord/fields";
import { SubmitButton } from "@/components/landlord/SubmitButton";

export function ApplyForm({
  roomId,
  maxOccupants,
  earliestMoveIn,
}: {
  roomId: string;
  maxOccupants: number;
  // YYYY-MM-DD: today, or the room's "available from" date if later.
  earliestMoveIn: string;
}) {
  const [state, action] = useActionState(applyForRoom.bind(null, roomId), {});
  const errors = state.fieldErrors;
  const v = state.values ?? { phone: "", moveInDate: earliestMoveIn, occupants: "1", message: "" };

  return (
    <form action={action} className="space-y-4">
      {errors?.form && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errors.form[0]}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Phone" name="phone" errors={errors}>
          <input name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} required className={inputClass} />
        </Field>
        <Field label="Move-in date" name="moveInDate" errors={errors}>
          <input name="moveInDate" type="date" min={earliestMoveIn} defaultValue={v.moveInDate} required className={inputClass} />
        </Field>
        <Field label="People" name="occupants" errors={errors}>
          <input
            name="occupants"
            type="number"
            min="1"
            max={maxOccupants}
            step="1"
            defaultValue={v.occupants}
            required
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Message to the landlord (optional)" name="message" errors={errors}>
        <textarea
          name="message"
          rows={3}
          defaultValue={v.message}
          placeholder="A little about you: work or study, how long you'd like to stay."
          className={inputClass}
        />
      </Field>
      <SubmitButton>Send application</SubmitButton>
    </form>
  );
}
