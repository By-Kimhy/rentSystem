import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

// The schemas are written for form fields, which are always strings. Bring JSON bodies to the
// same shape: missing fields and null become "", numbers and booleans become strings.
function asFormFields(schema: z.ZodType, input: unknown): unknown {
  if (!(schema instanceof z.ZodObject) || typeof input !== "object" || input === null) return input;
  const body = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
    const value = body[key];
    if (field instanceof z.ZodArray) {
      out[key] = value === undefined || value === null || value === "" ? [] : Array.isArray(value) ? value.map(String) : [String(value)];
    } else if (value === undefined || value === null) {
      out[key] = "";
    } else {
      out[key] = typeof value === "number" || typeof value === "boolean" ? String(value) : value;
    }
  }
  return out;
}

/** Parses input with a zod schema, or throws a 400 listing the bad fields. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(asFormFields(schema, input));
  if (!result.success) {
    throw new HttpError(400, "Some fields are invalid.", z.flattenError(result.error).fieldErrors as Record<string, string[]>);
  }
  return result.data;
}

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, "Not found."));
}

// Express 5 forwards rejected promises from handlers here. It needs all four parameters.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, fieldErrors: err.fieldErrors });
    return;
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Photos must be 5 MB or smaller." : err.message;
    res.status(400).json({ error: message, fieldErrors: { photos: [message] } });
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Request body is not valid JSON." });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
}
