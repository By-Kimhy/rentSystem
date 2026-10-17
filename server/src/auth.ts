// Sessions use the same signed JWT as the Next.js app (same cookie name, secret and claims),
// so a user signed in on either side is signed in on both.
import type { NextFunction, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { HttpError } from "./errors.js";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

export type SessionPayload = { userId: string; role: Role };
export type CurrentUser = { id: string; name: string; email: string; role: Role };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

const key = () => new TextEncoder().encode(config.sessionSecret());

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, key(), { algorithms: ["HS256"] });
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

// Browsers send the cookie; other clients (mobile apps, scripts) send `Authorization: Bearer <token>`.
function tokenFrom(req: Request) {
  const header = req.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.[SESSION_COOKIE] as string | undefined;
}

/** Loads the signed-in user, if any, onto req.user. The user is re-read from the database every request. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const session = await verifySession(tokenFrom(req));
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (user) req.user = user;
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new HttpError(401, "Sign in first.");
    if (roles.length && !roles.includes(req.user.role)) throw new HttpError(403, "You don't have access to this.");
    next();
  };
}

/** For use after requireRole: the signed-in user. */
export function currentUser(req: Request) {
  if (!req.user) throw new HttpError(401, "Sign in first.");
  return req.user;
}
