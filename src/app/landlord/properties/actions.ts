"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Property } from "@api/contract";
import { api, attempt } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { fieldsFrom, type FormState } from "@/lib/validation";

const PROPERTY_FIELDS = ["name", "type", "address", "city", "description"];
const ROOM_FIELDS = ["name", "rentPrice", "sizeSqm", "maxOccupants", "status", "availableFrom", "description"];

// Forwards the form, photos included, to the API as multipart.
function multipart(formData: FormData, keys: string[]) {
  const body = new FormData();
  for (const key of keys) body.set(key, String(formData.get(key) ?? ""));
  for (const file of formData.getAll("photos")) {
    if (file instanceof File && file.size > 0) body.append("photos", file, file.name);
  }
  return body;
}

export async function saveProperty(
  propertyId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("LANDLORD");
  const values = fieldsFrom(formData, PROPERTY_FIELDS);
  const body = multipart(formData, PROPERTY_FIELDS);
  const result = await attempt(() =>
    propertyId
      ? api.put<{ property: Property }>(`/landlord/properties/${propertyId}`, body)
      : api.post<{ property: Property }>("/landlord/properties", body),
  );
  if (!result.ok) return { fieldErrors: result.fieldErrors ?? { name: [result.error] }, values };

  revalidatePath("/landlord/properties");
  redirect(`/landlord/properties/${result.data.property.id}`);
}

export async function deleteProperty(propertyId: string) {
  await requireRole("LANDLORD");
  await api.delete(`/landlord/properties/${propertyId}`);
  revalidatePath("/landlord/properties");
  redirect("/landlord/properties");
}

export async function saveRoom(
  propertyId: string,
  roomId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("LANDLORD");
  const values = fieldsFrom(formData, ROOM_FIELDS);
  const body = multipart(formData, ROOM_FIELDS);
  const result = await attempt(() =>
    roomId ? api.put(`/landlord/rooms/${roomId}`, body) : api.post(`/landlord/properties/${propertyId}/rooms`, body),
  );
  if (!result.ok) return { fieldErrors: result.fieldErrors ?? { name: [result.error] }, values };

  revalidatePath(`/landlord/properties/${propertyId}`);
  revalidatePath("/landlord/properties");
  redirect(`/landlord/properties/${propertyId}`);
}

export async function deleteRoom(roomId: string) {
  await requireRole("LANDLORD");
  await api.delete(`/landlord/rooms/${roomId}`);
  revalidatePath("/landlord", "layout");
}

export async function deletePhoto(photoId: string) {
  await requireRole("LANDLORD");
  await api.delete(`/landlord/photos/${photoId}`);
  revalidatePath("/landlord/properties", "layout");
}
