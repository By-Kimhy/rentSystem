import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { clearSessionCookie, currentUser, requireRole, setSessionCookie, signSession } from "../auth.js";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { HttpError, parse } from "../errors.js";
import { sendEmail } from "../lib/mail.js";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "../validation.js";

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
  if (user.disabledAt) throw new HttpError(403, "This account has been disabled. Contact the site's admin.");
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

// ---- Forgot password

export const PASSWORD_RESET_MINUTES = 60;
// Links one account can ask for in an hour, so the form can't be used to flood an inbox.
export const PASSWORD_RESETS_PER_HOUR = 3;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

// The account a reset link opens, if the link is real, unused and not expired.
async function resetFor(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, disabledAt: true } } },
  });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date() || reset.user.disabledAt) return null;
  return reset;
}

const linkGone = () =>
  new HttpError(404, "This reset link has expired or was already used.");

// Always answers 204, whether or not the email has an account, so the form can't be used to
// find out who is signed up. The email goes out in the background for the same reason.
authRouter.post("/forgot-password", async (req, res) => {
  const { email } = parse(forgotPasswordSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, disabledAt: true } });
  if (user && !user.disabledAt) {
    const recent = await prisma.passwordReset.count({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
    });
    if (recent < PASSWORD_RESETS_PER_HOUR) {
      const token = randomBytes(32).toString("base64url");
      await prisma.passwordReset.create({
        data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + PASSWORD_RESET_MINUTES * 60_000) },
      });
      const link = `${config.appUrl()}/reset-password/${token}`;
      sendEmail({
        to: user.email,
        subject: "Reset your RentSystem password",
        text: [
          `Hi ${user.name},`,
          `Someone (hopefully you) asked to reset the password for your RentSystem account. Open this link to choose a new one:`,
          link,
          `The link works once and expires in ${PASSWORD_RESET_MINUTES} minutes. If you didn't ask for it, you can ignore this email and your password stays the same.`,
        ].join("\n\n"),
      }).catch((e) => console.error("Could not send the password reset email:", e));
    }
  }
  res.status(204).end();
});

authRouter.get("/reset-password/:token", async (req, res) => {
  const reset = await resetFor(req.params.token);
  if (!reset) throw linkGone();
  res.json({ email: reset.user.email });
});

// Sets the new password, ends every other session (see loadUser), and signs this browser in.
authRouter.post("/reset-password/:token", async (req, res) => {
  const { password } = parse(resetPasswordSchema, req.body);
  const reset = await resetFor(req.params.token);
  if (!reset) throw linkGone();
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const user = await prisma.$transaction(async (tx) => {
    // Claim the link first, so two submits at once can't both use it.
    const claimed = await tx.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count === 0) throw linkGone();
    await tx.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: now } });
    return tx.user.update({ where: { id: reset.userId }, data: { passwordHash, passwordChangedAt: now } });
  });
  const token = await signSession({ userId: user.id, role: user.role });
  setSessionCookie(res, token);
  sendEmail({
    to: user.email,
    subject: "Your RentSystem password was changed",
    text: [
      `Hi ${user.name},`,
      `The password for your RentSystem account was just changed, and every other device was signed out.`,
      `If this wasn't you, reset your password again straight away from ${config.appUrl()}/forgot-password and tell the site's admin.`,
    ].join("\n\n"),
  }).catch((e) => console.error("Could not send the password changed email:", e));
  res.json({ user: publicUser(user), token });
});
