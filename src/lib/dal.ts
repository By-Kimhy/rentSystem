// Data Access Layer: the one place that turns the session cookie into a user.
// Every protected page and Server Action authorizes through here.
import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { getSession } from "./session";
import { ROLE_HOME } from "./roles";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export async function getOptionalUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true },
  });
}

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
