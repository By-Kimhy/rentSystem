"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { photoFiles, removePhotoFiles, savePhotos, validatePhotos } from "@/lib/photos";
import { fieldsFrom, propertySchema, roomSchema, type FormState } from "@/lib/validation";

const PROPERTY_FIELDS = ["name", "type", "address", "city", "description"];
const ROOM_FIELDS = ["name", "rentPrice", "sizeSqm", "maxOccupants", "status", "availableFrom", "description"];

async function ownedProperty(propertyId: string, landlordId: string) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, landlordId } });
  if (!property) throw new Error("Property not found");
  return property;
}

async function ownedRoom(roomId: string, landlordId: string) {
  const room = await prisma.room.findFirst({ where: { id: roomId, property: { landlordId } } });
  if (!room) throw new Error("Room not found");
  return room;
}

export async function saveProperty(
  propertyId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const landlord = await requireRole("LANDLORD");
  const values = fieldsFrom(formData, PROPERTY_FIELDS);
  const parsed = propertySchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const files = photoFiles(formData);
  const photoError = validatePhotos(files);
  if (photoError) return { fieldErrors: { photos: [photoError] }, values };

  if (propertyId) await ownedProperty(propertyId, landlord.id);
  const fileNames = await savePhotos(files);
  const photos = { create: fileNames.map((fileName) => ({ fileName })) };

  const property = propertyId
    ? await prisma.property.update({ where: { id: propertyId }, data: { ...parsed.data, photos } })
    : await prisma.property.create({ data: { ...parsed.data, landlordId: landlord.id, photos } });

  revalidatePath("/landlord/properties");
  redirect(`/landlord/properties/${property.id}`);
}

export async function deleteProperty(propertyId: string) {
  const landlord = await requireRole("LANDLORD");
  await ownedProperty(propertyId, landlord.id);
  const photos = await prisma.photo.findMany({
    where: { OR: [{ propertyId }, { room: { propertyId } }] },
    select: { fileName: true },
  });
  await prisma.property.delete({ where: { id: propertyId } });
  await removePhotoFiles(photos.map((p) => p.fileName));
  revalidatePath("/landlord/properties");
  redirect("/landlord/properties");
}

export async function saveRoom(
  propertyId: string,
  roomId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const landlord = await requireRole("LANDLORD");
  await ownedProperty(propertyId, landlord.id);
  if (roomId) {
    const room = await ownedRoom(roomId, landlord.id);
    if (room.propertyId !== propertyId) throw new Error("Room not found");
  }
  const values = fieldsFrom(formData, ROOM_FIELDS);
  const parsed = roomSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const files = photoFiles(formData);
  const photoError = validatePhotos(files);
  if (photoError) return { fieldErrors: { photos: [photoError] }, values };

  const fileNames = await savePhotos(files);
  const photos = { create: fileNames.map((fileName) => ({ fileName })) };

  if (roomId) await prisma.room.update({ where: { id: roomId }, data: { ...parsed.data, photos } });
  else await prisma.room.create({ data: { ...parsed.data, propertyId, photos } });

  revalidatePath(`/landlord/properties/${propertyId}`);
  revalidatePath("/landlord/properties");
  redirect(`/landlord/properties/${propertyId}`);
}

export async function deleteRoom(roomId: string) {
  const landlord = await requireRole("LANDLORD");
  const room = await ownedRoom(roomId, landlord.id);
  const photos = await prisma.photo.findMany({ where: { roomId }, select: { fileName: true } });
  await prisma.room.delete({ where: { id: roomId } });
  await removePhotoFiles(photos.map((p) => p.fileName));
  revalidatePath(`/landlord/properties/${room.propertyId}`);
  revalidatePath("/landlord/properties");
}

export async function deletePhoto(photoId: string) {
  const landlord = await requireRole("LANDLORD");
  const photo = await prisma.photo.findFirst({
    where: {
      id: photoId,
      OR: [{ property: { landlordId: landlord.id } }, { room: { property: { landlordId: landlord.id } } }],
    },
    include: { room: { select: { propertyId: true } } },
  });
  if (!photo) throw new Error("Photo not found");
  await prisma.photo.delete({ where: { id: photoId } });
  await removePhotoFiles([photo.fileName]);
  revalidatePath(`/landlord/properties/${photo.propertyId ?? photo.room?.propertyId}`, "layout");
}
