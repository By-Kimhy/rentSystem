"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, attempt } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { fieldsFrom, type FormState } from "@/lib/validation";

export async function applyForRoom(roomId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("TENANT");
  const values = fieldsFrom(formData, ["phone", "moveInDate", "occupants", "message"]);
  const result = await attempt(() => api.post("/tenant/applications", { ...values, roomId }));
  // A 409 (already applied, room just taken) has no field, so it shows above the form.
  if (!result.ok) return { fieldErrors: result.fieldErrors ?? { form: [result.error] }, values };
  revalidatePath("/tenant");
  redirect(`/rooms/${roomId}`);
}
