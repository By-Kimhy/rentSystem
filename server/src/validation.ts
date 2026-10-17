// Request validation. The schemas take strings, as HTML forms send them; parse() in errors.ts
// turns JSON numbers and nulls into strings first, so JSON clients can send either.
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

const optionalLine = z
  .string()
  .trim()
  .max(255)
  .transform((v) => v || null);

const requiredDate = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .transform((v) => new Date(`${v}T00:00:00Z`))
    .refine((v) => !Number.isNaN(v.getTime()), "Invalid date.");

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : new Date(`${v}T00:00:00Z`)))
  .refine((v) => v === null || !Number.isNaN(v.getTime()), "Invalid date.");

const money = z.coerce
  .number({ message: "Must be a number." })
  .min(0, "Can't be negative.")
  .max(99_999_999);

export const tenantSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required.").max(120),
  phone: z.string().trim().min(1, "Phone is required.").max(40),
  email: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email.")
    .transform((v) => v || null),
  idDocType: optionalLine,
  idDocNumber: optionalLine,
  emergencyContact: optionalLine,
  notes: optionalText,
});

export const leaseSchema = z
  .object({
    roomId: z.string().min(1, "Choose a room."),
    primaryTenantId: z.string().min(1, "Choose the primary tenant."),
    otherTenantIds: z.array(z.string()),
    startDate: requiredDate("Start date is required."),
    endDate: optionalDate,
    // Blank means "use the room's listed rent".
    rentAmount: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine((v) => v === null || (Number.isFinite(v) && v > 0 && v <= 99_999_999), "Rent must be more than 0."),
    dueDay: z.coerce.number().int("Must be a whole number.").min(1, "Use a day from 1 to 28.").max(28, "Use a day from 1 to 28."),
    depositAmount: money,
    graceDays: z.coerce.number().int("Must be a whole number.").min(0, "Can't be negative.").max(60),
    lateFeeType: z.enum(["NONE", "FLAT", "PERCENT"]),
    lateFeeValue: money,
    notes: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after the start date." });
    }
    if (v.lateFeeType !== "NONE" && v.lateFeeValue <= 0) {
      ctx.addIssue({ code: "custom", path: ["lateFeeValue"], message: "Enter the late fee amount." });
    }
    if (v.lateFeeType === "PERCENT" && v.lateFeeValue > 100) {
      ctx.addIssue({ code: "custom", path: ["lateFeeValue"], message: "A percentage can't be more than 100." });
    }
  });

export const endLeaseSchema = z.object({ endOn: requiredDate("Choose the last day of the lease.") });

const positiveMoney = z.coerce
  .number({ message: "Must be a number." })
  .positive("Must be more than 0.")
  .max(99_999_999);

export const chargeSchema = z.object({
  kind: z.enum(["UTILITY", "OTHER"]),
  description: z.string().trim().min(1, "Describe the charge.").max(255),
  amount: positiveMoney,
  dueDate: requiredDate("Choose a due date."),
});

export const voidSchema = z.object({ reason: z.string().trim().min(1, "Give a reason for voiding.").max(255) });

export const paymentSchema = z.object({
  leaseId: z.string().min(1, "Choose a lease."),
  payerTenantId: z.string().transform((v) => v || null),
  amount: positiveMoney,
  method: z.enum(["CASH", "BANK", "CARD", "WALLET"], { message: "Choose how it was paid." }),
  paidOn: requiredDate("Choose the payment date."),
  reference: optionalLine,
  notes: optionalText,
});

export const depositTransactionSchema = z.object({
  kind: z.enum(["DEDUCTION", "REFUND"]),
  amount: positiveMoney,
  date: requiredDate("Choose a date."),
  reason: optionalLine,
});

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.email("Enter a valid email.").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(["LANDLORD", "TENANT"], "Choose landlord or tenant."),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

export const reverseSchema = z.object({ reason: z.string().trim().min(1, "Give a reason for the reversal.").max(255) });

export const roomSearchSchema = z.object({
  city: z.string().trim().max(120),
  type: z.union([z.literal(""), z.enum(["APARTMENT", "CONDO", "HOUSE"])]),
  minRent: z.string().trim().transform((v) => (v === "" ? null : Number(v))).refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Must be a number."),
  maxRent: z.string().trim().transform((v) => (v === "" ? null : Number(v))).refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Must be a number."),
  occupants: z.string().trim().transform((v) => (v === "" ? null : Number(v))).refine((v) => v === null || (Number.isInteger(v) && v >= 1), "Must be a whole number."),
});
