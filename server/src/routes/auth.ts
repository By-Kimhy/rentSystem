import bcrypt from "bcryptjs";
import { Router } from "express";
import { clearSessionCookie, currentUser, requireRole, setSessionCookie, signSession } from "../auth.js";
import { prisma } from "../db.js";
import { HttpError, parse } from "../errors.js";
import { loginSchema, signupSchema } from "../validation.js";

export const authRouter = Router();

const publicUser = (u: { id: string; name: string; email: string; role: string }) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});

// Responses carry the token too, for clients that can't use cookies.
authRouter.post("/signup", async (req, res) => {
  const { name, email, password, role } = parse(signupSchema, req.body);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists.", {
      email: ["An account with this email already exists."],
    });
  }
  const user = await prisma.user.create({
    data: { name, email, role, passwordHash: await bcrypt.hash(password, 12) },
  });
  const token = await signSession({ userId: user.id, role: user.role });
  setSessionCookie(res, token);
  res.status(201).json({ user: publicUser(user), token });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) throw new HttpError(401, "Incorrect email or password.");
  const token = await signSession({ userId: user.id, role: user.role });
  setSessionCookie(res, token);
  res.json({ user: publicUser(user), token });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get("/me", requireRole(), (req, res) => {
  res.json({ user: currentUser(req) });
});
