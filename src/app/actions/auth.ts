"use server";

import { redirect } from "next/navigation";
import type { AuthResponse } from "@api/contract";
import { ApiError, api, attempt } from "@/lib/api";
import { ROLE_HOME } from "@/lib/roles";
import { createSession, deleteSession } from "@/lib/session";

export type FormState =
  | {
      errors?: Record<string, string[] | undefined>;
      message?: string;
      values?: Record<string, string>;
    }
  | undefined;

// Only allow same-site relative paths, so `?next=` can't redirect off-site.
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "");

export async function signup(_state: FormState, formData: FormData): Promise<FormState> {
  const body = {
    name: field(formData, "name"),
    email: field(formData, "email"),
    password: field(formData, "password"),
    role: field(formData, "role"),
  };
  const values = { name: body.name, email: body.email, role: body.role };
  const result = await attempt(() => api.post<AuthResponse>("/auth/signup", body));
  if (!result.ok) return { errors: result.fieldErrors, message: result.fieldErrors ? undefined : result.error, values };

  await createSession(result.data.token);
  redirect(ROLE_HOME[result.data.user.role]);
}

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const body = { email: field(formData, "email"), password: field(formData, "password") };
  const values = { email: body.email };
  let result;
  try {
    result = await api.post<AuthResponse>("/auth/login", body);
  } catch (e) {
    // A wrong password is a 401 here, not a lost session, so attempt() doesn't fit.
    if (e instanceof ApiError && e.status === 400) return { errors: e.fieldErrors, values };
    if (e instanceof ApiError && e.status === 401) return { message: e.message, values };
    throw e;
  }

  await createSession(result.token);
  redirect(safeNext(formData.get("next")) ?? ROLE_HOME[result.user.role]);
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
