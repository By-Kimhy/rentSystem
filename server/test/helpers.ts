import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/app.js";

export const app = createApp();

/** Signs up a fresh account and returns a supertest agent that keeps its session cookie. */
export async function signUp(role: "LANDLORD" | "TENANT", name = `Test ${role.toLowerCase()}`) {
  const agent = request.agent(app);
  const email = `${role.toLowerCase()}-${randomUUID()}@test.local`;
  const res = await agent.post("/api/auth/signup").send({ name, email, password: "password123", role });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, email, user: res.body.user as { id: string; name: string }, token: res.body.token as string };
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
