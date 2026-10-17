// The one place that turns the session cookie into a user, by asking the API.
// Every protected page checks the role here; the API checks it again on every call.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { CurrentUser, Role } from "@api/contract";
import { ApiError, api } from "./api";
import { ROLE_HOME } from "./roles";

export type { CurrentUser };

// Cached per request, so a page and its layout share one lookup.
export const getOptionalUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    return (await api.get<{ user: CurrentUser }>("/auth/me")).user;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
});

export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  return user;
}

// Signed-in users with any other role are sent to their own dashboard.
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}
