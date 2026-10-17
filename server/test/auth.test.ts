import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, signUp } from "./helpers.js";

describe("auth", () => {
  it("signs up, reads the session, logs out and logs back in", async () => {
    const { agent, email, user } = await signUp("TENANT", "Ada Tenant");
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.user).toMatchObject({ id: user.id, email, role: "TENANT", name: "Ada Tenant" });

    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/auth/me").expect(401);

    const login = await agent.post("/api/auth/login").send({ email, password: "password123" }).expect(200);
    expect(login.body.token).toEqual(expect.any(String));
    await agent.get("/api/auth/me").expect(200);
  });

  it("accepts a bearer token instead of the cookie", async () => {
    const { token } = await signUp("LANDLORD");
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    await request(app).get("/api/auth/me").set("Authorization", "Bearer nonsense").expect(401);
  });

  it("rejects bad sign-ups and wrong passwords with field errors", async () => {
    const bad = await request(app).post("/api/auth/signup").send({ name: "A", email: "nope", password: "short", role: "ADMIN" });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.fieldErrors)).toEqual(expect.arrayContaining(["name", "email", "password", "role"]));

    const { email } = await signUp("TENANT");
    const dup = await request(app).post("/api/auth/signup").send({ name: "Again", email, password: "password123", role: "TENANT" });
    expect(dup.status).toBe(409);

    const wrong = await request(app).post("/api/auth/login").send({ email, password: "wrong-password" });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toBe("Incorrect email or password.");
  });

  it("keeps each role to its own endpoints", async () => {
    const tenant = await signUp("TENANT");
    await tenant.agent.get("/api/landlord/properties").expect(403);
    await tenant.agent.get("/api/admin/users").expect(403);
    await request(app).get("/api/landlord/properties").expect(401);
  });
});
