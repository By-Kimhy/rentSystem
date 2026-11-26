// Forgot password: a one-time emailed link that sets a new password and signs out old sessions.
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import { outbox } from "../src/lib/mail.js";
import { app, signUp } from "./helpers.js";

const linkIn = (text: string) => text.match(/http:\/\/web\.test\/reset-password\/([A-Za-z0-9_-]+)/)?.[1];
const mailTo = (email: string) => outbox.filter((m) => m.to === email);

describe("forgot password", () => {
  beforeEach(() => {
    outbox.length = 0;
  });

  it("emails a one-time link that sets a new password and signs other sessions out", async () => {
    const { agent, email } = await signUp("TENANT", "Rita Reset");
    await agent.get("/api/auth/me").expect(200);

    await request(app).post("/api/auth/forgot-password").send({ email: email.toUpperCase() }).expect(204);
    const [mail] = mailTo(email);
    expect(mail.subject).toMatch(/reset your/i);
    const token = linkIn(mail.text)!;
    expect(token).toBeTruthy();
    // Only the hash is stored.
    expect(await prisma.passwordReset.count({ where: { tokenHash: token } })).toBe(0);

    const check = await request(app).get(`/api/auth/reset-password/${token}`).expect(200);
    expect(check.body.email).toBe(email);

    await request(app).post(`/api/auth/reset-password/${token}`).send({ password: "short" }).expect(400);

    // JWT times are whole seconds: let the old session's second pass so it is plainly older.
    await new Promise((r) => setTimeout(r, 1100));
    const reset = request.agent(app);
    const done = await reset.post(`/api/auth/reset-password/${token}`).send({ password: "brand-new-pass" }).expect(200);
    expect(done.body.user.email).toBe(email);
    await reset.get("/api/auth/me").expect(200);

    // The old session is signed out; the old password no longer works and the new one does.
    await agent.get("/api/auth/me").expect(401);
    await request(app).post("/api/auth/login").send({ email, password: "password123" }).expect(401);
    await request(app).post("/api/auth/login").send({ email, password: "brand-new-pass" }).expect(200);

    // The link works once, and the account is told its password changed.
    await request(app).get(`/api/auth/reset-password/${token}`).expect(404);
    await request(app).post(`/api/auth/reset-password/${token}`).send({ password: "another-pass" }).expect(404);
    expect(mailTo(email).map((m) => m.subject)).toContain("Your RentSystem password was changed");
  });

  it("answers the same for unknown emails and sends nothing", async () => {
    await request(app).post("/api/auth/forgot-password").send({ email: "nobody-here@test.local" }).expect(204);
    await request(app).post("/api/auth/forgot-password").send({ email: "not an email" }).expect(400);
    expect(outbox).toHaveLength(0);
  });

  it("sends at most 3 links an hour, none to disabled accounts, and refuses made-up or expired links", async () => {
    const { email, user } = await signUp("LANDLORD");
    for (let i = 0; i < 4; i++) await request(app).post("/api/auth/forgot-password").send({ email }).expect(204);
    expect(mailTo(email)).toHaveLength(3);

    const token = linkIn(mailTo(email)[0].text)!;
    await prisma.passwordReset.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await request(app).get(`/api/auth/reset-password/${token}`).expect(404);
    await request(app).get("/api/auth/reset-password/made-up-token-made-up-token").expect(404);

    const disabled = await signUp("TENANT");
    await prisma.user.update({ where: { id: disabled.user.id }, data: { disabledAt: new Date() } });
    await request(app).post("/api/auth/forgot-password").send({ email: disabled.email }).expect(204);
    expect(mailTo(disabled.email)).toHaveLength(0);
  });
});
