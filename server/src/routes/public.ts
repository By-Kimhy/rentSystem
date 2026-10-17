// Endpoints anyone can call: browsing available rooms and serving photos.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { config } from "../config.js";
import { listingInclude } from "../contract.js";
import { prisma } from "../db.js";
import { HttpError, parse } from "../errors.js";
import { CONTENT_TYPES, PHOTO_NAME } from "../photos.js";
import { roomSearchSchema } from "../validation.js";

export const publicRouter = Router();

// GET /api/rooms?city=&type=&minRent=&maxRent=&occupants=  (all optional)
publicRouter.get("/rooms", async (req, res) => {
  const q = parse(roomSearchSchema, req.query);
  const rentPrice: Prisma.DecimalFilter<"Room"> = {};
  if (q.minRent !== null) rentPrice.gte = q.minRent;
  if (q.maxRent !== null) rentPrice.lte = q.maxRent;
  const rooms = await prisma.room.findMany({
    where: {
      status: "AVAILABLE",
      rentPrice,
      ...(q.occupants !== null && { maxOccupants: { gte: q.occupants } }),
      property: {
        // A disabled landlord can't answer applications, so their rooms aren't listed.
        landlord: { disabledAt: null },
        ...(q.city && { city: { contains: q.city } }),
        ...(q.type && { type: q.type }),
      },
    },
    include: listingInclude,
    orderBy: [{ rentPrice: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  res.json({ rooms });
});

publicRouter.get("/rooms/:id", async (req, res) => {
  const room = await prisma.room.findFirst({
    where: { id: req.params.id, status: "AVAILABLE", property: { landlord: { disabledAt: null } } },
    include: listingInclude,
  });
  if (!room) throw new HttpError(404, "Room not found.");
  res.json({ room });
});

publicRouter.get("/photos/:fileName", async (req, res) => {
  const match = PHOTO_NAME.exec(req.params.fileName);
  if (!match) throw new HttpError(404, "Not found.");
  let data: Buffer;
  try {
    data = await readFile(path.join(config.uploadDir(), req.params.fileName));
  } catch {
    throw new HttpError(404, "Not found.");
  }
  res.type(CONTENT_TYPES[match[1]]).set("Cache-Control", "public, max-age=31536000, immutable").send(data);
});
