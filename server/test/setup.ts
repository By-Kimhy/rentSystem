import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll } from "vitest";
import { prisma } from "../src/db.js";

const envFile = path.resolve(import.meta.dirname, "../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret";
process.env.CRON_SECRET ||= "test-cron-secret";

afterAll(async () => {
  await prisma.$disconnect();
});
