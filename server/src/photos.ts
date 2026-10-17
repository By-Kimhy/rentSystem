import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RequestHandler } from "express";
import multer from "multer";
import { config } from "./config.js";
import { HttpError } from "./errors.js";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS_PER_REQUEST = 20;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CONTENT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type]),
);

// Stored names are always <uuid>.<ext>; anything else (including path tricks) is rejected.
export const PHOTO_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Accepts JSON or multipart bodies; multipart may carry files in a `photos` field. */
// Typed with plain string params so routes keep their own `:id` param types.
export const photoUpload: RequestHandler<Record<string, string>> = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS_PER_REQUEST },
  fileFilter: (_req, file, cb) => {
    if (EXTENSIONS[file.mimetype]) return cb(null, true);
    const message = `${file.originalname}: only JPEG, PNG or WebP images are allowed.`;
    cb(new HttpError(400, message, { photos: [message] }));
  },
}).array("photos");

export function photoUrl(fileName: string) {
  return `/api/photos/${fileName}`;
}

/** Writes uploaded files to disk and returns their stored file names. */
export async function savePhotos(files: Express.Multer.File[] | undefined) {
  if (!files?.length) return [];
  const dir = config.uploadDir();
  await mkdir(dir, { recursive: true });
  const names: string[] = [];
  for (const file of files) {
    const name = `${randomUUID()}.${EXTENSIONS[file.mimetype]}`;
    await writeFile(path.join(dir, name), file.buffer);
    names.push(name);
  }
  return names;
}

export async function removePhotoFiles(fileNames: string[]) {
  await Promise.all(
    fileNames.map((name) => unlink(path.join(config.uploadDir(), name)).catch(() => undefined)),
  );
}
