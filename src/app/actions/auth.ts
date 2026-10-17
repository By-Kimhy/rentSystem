"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { ROLE_HOME, SIGNUP_ROLES } from "@/lib/roles";

export type FormState =
  | {
      errors?: Record<string, string[] | undefined>;
      message?: string;
      values?: Record<string, string>;
    }
  | undefined;

const SignupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120, "Name is too long."),
  email: z.email("Enter a valid email.").max(255).trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(SIGNUP_ROLES, "Choose landlord or tenant."),
});

const LoginSchema = z.object({
  email: z.email("Enter a valid email.").max(255).trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

// Only allow same-site relative paths, so `?next=` can't redirect off-site.
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function signup(_state: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? ""),
  };
  const parsed = SignupSchema.safeParse(raw);
  const values = { name: raw.name, email: raw.email, role: raw.role };
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { name, email, password, role } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { errors: { email: ["An account with this email already exists."] }, values };
  }

  const user = await prisma.user.create({
    data: { name, email, role, passwordHash: await bcrypt.hash(password, 12) },
  });
  await createSession({ userId: user.id, role: user.role });
  redirect(ROLE_HOME[user.role]);
}

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = LoginSchema.safeParse(raw);
  const values = { email: raw.email };
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!user || !ok) {
    return { message: "Incorrect email or password.", values };
  }

  await createSession({ userId: user.id, role: user.role });
  redirect(safeNext(formData.get("next")) ?? ROLE_HOME[user.role]);
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
