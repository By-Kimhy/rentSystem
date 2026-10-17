// Admin tools: platform overview, all properties, and disabling accounts.
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import { app, signUp } from "./helpers.js";

// Sign-up can't create admins, so make one directly and sign in.
async function admin() {
  const email = `admin-${randomUUID()}@test.local`;
  await prisma.user.create({
    data: { name: "Ada Admin", email, role: "ADMIN", passwordHash: await bcrypt.hash("password123", 4) },
  });
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: "password123" }).expect(200);
  const me = await agent.get("/api/auth/me").expect(200);
  return { agent, id: me.body.user.id as string };
}

describe("admin tools", () => {
  it("shows platform totals and every property, to admins only", async () => {
    const { agent } = await admin();
    const landlord = await signUp("LANDLORD", "Lena Landlord");
    await landlord.agent
      .post("/api/landlord/properties")
      .send({ name: "Admin Test Villa", type: "HOUSE", address: "1 Test St", city: "Kratie" })
      .expect(201);

    const overview = await agent.get("/api/admin/overview").expect(200);
    expect(overview.body.users.landlords).toBeGreaterThanOrEqual(1);
    expect(overview.body.properties).toBeGreaterThanOrEqual(1);
    expect(overview.body).toHaveProperty("billedCents");

    const props = await agent.get("/api/admin/properties").query({ q: "Admin Test Villa" }).expect(200);
    expect(props.body.total).toBeGreaterThanOrEqual(1);
    const found = await agent.get("/api/admin/users").query({ q: landlord.email }).expect(200);
    expect(found.body).toMatchObject({ total: 1, users: [{ email: landlord.email, _count: { properties: 1 } }] });
    expect(props.body.properties.find((p: { name: string }) => p.name === "Admin Test Villa")).toMatchObject({
      city: "Kratie",
      landlord: { name: "Lena Landlord" },
      rooms: [],
    });

    await landlord.agent.get("/api/admin/overview").expect(403);
    await request(app).get("/api/admin/properties").expect(401);
  });

  it("disables an account at once and lets it back in when enabled", async () => {
    const { agent, id: adminId } = await admin();
    const tenant = await signUp("TENANT", "Tom Tenant");
    await tenant.agent.get("/api/tenant/home").expect(200);

    const disabled = await agent.post(`/api/admin/users/${tenant.user.id}/disable`).expect(200);
    expect(disabled.body.user.disabledAt).toBeTruthy();
    // The existing session stops working, and signing in again is refused.
    await tenant.agent.get("/api/tenant/home").expect(401);
    await tenant.agent.get("/api/auth/me").expect(401);
    const refused = await request(app).post("/api/auth/login").send({ email: tenant.email, password: "password123" }).expect(403);
    expect(refused.body.error).toMatch(/disabled/);

    await agent.post(`/api/admin/users/${tenant.user.id}/enable`).expect(200);

    // A disabled landlord's rooms leave the public listings until they're enabled again.
    const landlord = await signUp("LANDLORD");
    const property = await landlord.agent
      .post("/api/landlord/properties")
      .send({ name: "Hidden Flats", type: "APARTMENT", address: "2 Test St", city: "Pailin" })
      .expect(201);
    const room = await landlord.agent
      .post(`/api/landlord/properties/${property.body.property.id}/rooms`)
      .send({ name: "R1", rentPrice: 90, maxOccupants: 1, status: "AVAILABLE" })
      .expect(201);
    const listed = async () =>
      (await request(app).get("/api/rooms").query({ city: "Pailin" }).expect(200)).body.rooms.map((r: { id: string }) => r.id);
    expect(await listed()).toContain(room.body.room.id);
    await agent.post(`/api/admin/users/${landlord.user.id}/disable`).expect(200);
    expect(await listed()).not.toContain(room.body.room.id);
    await request(app).get(`/api/rooms/${room.body.room.id}`).expect(404);
    await agent.post(`/api/admin/users/${landlord.user.id}/enable`).expect(200);
    expect(await listed()).toContain(room.body.room.id);
    await tenant.agent.get("/api/tenant/home").expect(200);
    await request(app).post("/api/auth/login").send({ email: tenant.email, password: "password123" }).expect(200);

    // Admins can't be disabled, including yourself.
    await agent.post(`/api/admin/users/${adminId}/disable`).expect(409);
    const other = await admin();
    await agent.post(`/api/admin/users/${other.id}/disable`).expect(409);
    await agent.post("/api/admin/users/nope/disable").expect(404);
    await tenant.agent.post(`/api/admin/users/${tenant.user.id}/enable`).expect(403);
  });
});
