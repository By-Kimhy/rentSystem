import { readFile } from "node:fs/promises";
import path from "node:path";
import { CONTENT_TYPES, uploadDir } from "@/lib/photos";

export async function GET(_req: Request, { params }: { params: Promise<{ fileName: string }> }) {
  const { fileName } = await params;
  // Stored names are always <uuid>.<ext>; reject anything else (including path tricks).
  const match = /^[0-9a-f-]{36}\.(jpg|png|webp)$/.exec(fileName);
  if (!match) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(/*turbopackIgnore: true*/ uploadDir(), fileName));
    return new Response(data, {
      headers: {
        "Content-Type": CONTENT_TYPES[match[1]],
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
