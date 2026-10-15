import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CONTENT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type]),
);

// Photos live outside the build; turbopackIgnore stops the bundler tracing the whole project.
export function uploadDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./uploads");
}

export function photoUrl(fileName: string) {
  return `/api/photos/${fileName}`;
}

/** Pulls the non-empty files out of a multi-file input. */
export function photoFiles(formData: FormData, field = "photos") {
  return formData
    .getAll(field)
    .filter((f): f is File => f instanceof File && f.size > 0);
}

/** Returns an error message for the first invalid file, or null. */
export function validatePhotos(files: File[]) {
  for (const file of files) {
    if (!EXTENSIONS[file.type]) return `${file.name}: only JPEG, PNG or WebP images are allowed.`;
    if (file.size > MAX_PHOTO_BYTES) return `${file.name}: photos must be 5 MB or smaller.`;
  }
  return null;
}

/** Writes validated files to disk and returns their stored file names. */
export async function savePhotos(files: File[]) {
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  const names: string[] = [];
  for (const file of files) {
    const name = `${randomUUID()}.${EXTENSIONS[file.type]}`;
    await writeFile(path.join(/*turbopackIgnore: true*/ dir, name), Buffer.from(await file.arrayBuffer()));
    names.push(name);
  }
  return names;
}

export async function removePhotoFiles(fileNames: string[]) {
  await Promise.all(
    fileNames.map((name) => unlink(path.join(/*turbopackIgnore: true*/ uploadDir(), name)).catch(() => undefined)),
  );
}
