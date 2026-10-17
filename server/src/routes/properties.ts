// Landlords manage their own properties, rooms and photos. Every query is scoped to the
// signed-in landlord, so another landlord's ids return 404.
import { Router } from "express";
import { currentUser } from "../auth.js";
import { propertyCardInclude, propertyDetailInclude, roomDetailInclude } from "../contract.js";
import { prisma } from "../db.js";
import { HttpError, parse } from "../errors.js";
import { photoUpload, removePhotoFiles, savePhotos } from "../photos.js";
import { propertySchema, roomSchema } from "../validation.js";

export const propertiesRouter = Router();

async function ownedProperty(propertyId: string, landlordId: string) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, landlordId } });
  if (!property) throw new HttpError(404, "Property not found.");
  return property;
}

async function ownedRoom(roomId: string, landlordId: string) {
  const room = await prisma.room.findFirst({ where: { id: roomId, property: { landlordId } } });
  if (!room) throw new HttpError(404, "Room not found.");
  return room;
}

const createPhotos = (fileNames: string[]) => ({ create: fileNames.map((fileName) => ({ fileName })) });

propertiesRouter.get("/properties", async (req, res) => {
  const properties = await prisma.property.findMany({
    where: { landlordId: currentUser(req).id },
    orderBy: { createdAt: "desc" },
    include: propertyCardInclude,
  });
  res.json({ properties });
});

// Bodies may be JSON or multipart; multipart can add photos in a `photos` file field.
propertiesRouter.post("/properties", photoUpload, async (req, res) => {
  const data = parse(propertySchema, req.body);
  const fileNames = await savePhotos(req.files as Express.Multer.File[]);
  const property = await prisma.property.create({
    data: { ...data, landlordId: currentUser(req).id, photos: createPhotos(fileNames) },
  });
  res.status(201).json({ property });
});

propertiesRouter.get("/properties/:id", async (req, res) => {
  const property = await prisma.property.findFirst({
    where: { id: req.params.id, landlordId: currentUser(req).id },
    include: propertyDetailInclude,
  });
  if (!property) throw new HttpError(404, "Property not found.");
  res.json({ property });
});

// Replaces the property's fields; uploaded photos are added to the existing ones.
propertiesRouter.put("/properties/:id", photoUpload, async (req, res) => {
  await ownedProperty(req.params.id, currentUser(req).id);
  const data = parse(propertySchema, req.body);
  const fileNames = await savePhotos(req.files as Express.Multer.File[]);
  const property = await prisma.property.update({
    where: { id: req.params.id },
    data: { ...data, photos: createPhotos(fileNames) },
  });
  res.json({ property });
});

propertiesRouter.delete("/properties/:id", async (req, res) => {
  const propertyId = req.params.id;
  await ownedProperty(propertyId, currentUser(req).id);
  if (await prisma.lease.count({ where: { room: { propertyId } } })) {
    throw new HttpError(409, "This property has lease history, so it can't be deleted.");
  }
  const photos = await prisma.photo.findMany({
    where: { OR: [{ propertyId }, { room: { propertyId } }] },
    select: { fileName: true },
  });
  await prisma.property.delete({ where: { id: propertyId } });
  await removePhotoFiles(photos.map((p) => p.fileName));
  res.status(204).end();
});

propertiesRouter.post("/properties/:id/rooms", photoUpload, async (req, res) => {
  await ownedProperty(req.params.id, currentUser(req).id);
  const data = parse(roomSchema, req.body);
  const fileNames = await savePhotos(req.files as Express.Multer.File[]);
  const room = await prisma.room.create({
    data: { ...data, propertyId: req.params.id, photos: createPhotos(fileNames) },
  });
  res.status(201).json({ room });
});

propertiesRouter.get("/rooms/:id", async (req, res) => {
  const room = await prisma.room.findFirst({
    where: { id: req.params.id, property: { landlordId: currentUser(req).id } },
    include: roomDetailInclude,
  });
  if (!room) throw new HttpError(404, "Room not found.");
  res.json({ room });
});

propertiesRouter.put("/rooms/:id", photoUpload, async (req, res) => {
  await ownedRoom(req.params.id, currentUser(req).id);
  const data = parse(roomSchema, req.body);
  const fileNames = await savePhotos(req.files as Express.Multer.File[]);
  const room = await prisma.room.update({
    where: { id: req.params.id },
    data: { ...data, photos: createPhotos(fileNames) },
  });
  res.json({ room });
});

propertiesRouter.delete("/rooms/:id", async (req, res) => {
  const roomId = req.params.id;
  await ownedRoom(roomId, currentUser(req).id);
  if (await prisma.lease.count({ where: { roomId } })) {
    throw new HttpError(409, "This room has lease history, so it can't be deleted.");
  }
  const photos = await prisma.photo.findMany({ where: { roomId }, select: { fileName: true } });
  await prisma.room.delete({ where: { id: roomId } });
  await removePhotoFiles(photos.map((p) => p.fileName));
  res.status(204).end();
});

propertiesRouter.delete("/photos/:id", async (req, res) => {
  const landlordId = currentUser(req).id;
  const photo = await prisma.photo.findFirst({
    where: {
      id: req.params.id,
      OR: [{ property: { landlordId } }, { room: { property: { landlordId } } }],
    },
  });
  if (!photo) throw new HttpError(404, "Photo not found.");
  await prisma.photo.delete({ where: { id: photo.id } });
  await removePhotoFiles([photo.fileName]);
  res.status(204).end();
});
