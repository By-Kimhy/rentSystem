import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .transform((v) => v || null);

export const propertySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  type: z.enum(["APARTMENT", "CONDO", "HOUSE"], { message: "Choose a property type." }),
  address: z.string().trim().min(1, "Address is required.").max(255),
  city: z.string().trim().min(1, "City is required.").max(120),
  description: optionalText,
});

export const roomSchema = z.object({
  name: z.string().trim().min(1, "Room name is required.").max(120),
  rentPrice: z.coerce
    .number({ message: "Rent must be a number." })
    .positive("Rent must be more than 0.")
    .max(99_999_999),
  sizeSqm: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v > 0 && v < 100_000), "Size must be a positive number."),
  maxOccupants: z.coerce.number().int("Must be a whole number.").min(1, "At least 1 occupant.").max(50),
  status: z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE"]),
  availableFrom: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : new Date(`${v}T00:00:00Z`)))
    .refine((v) => v === null || !Number.isNaN(v.getTime()), "Invalid date."),
  description: optionalText,
});

export type FormState = {
  fieldErrors?: Record<string, string[] | undefined>;
  // Echoed back on error so the form, which React resets after submit, keeps what was typed.
  values?: Record<string, string>;
};

export function fieldsFrom(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}
