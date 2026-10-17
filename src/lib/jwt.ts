// Reads the session token the API signs (same SESSION_SECRET). No server-only imports so
// proxy.ts can use it for its quick redirects.
import { jwtVerify } from "jose";
import type { Role } from "@api/contract";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

export type SessionPayload = {
  userId: string;
  role: Role;
};

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getKey(), {
      algorithms: ["HS256"],
    });
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}
