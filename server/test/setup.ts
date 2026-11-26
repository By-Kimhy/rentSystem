import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll } from "vitest";
import { prisma } from "../src/db.js";

const envFile = path.resolve(import.meta.dirname, "../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret";
process.env.CRON_SECRET ||= "test-cron-secret";
// Emails land in `outbox` (src/lib/mail.ts) instead of being sent.
process.env.MAIL_PROVIDER = "memory";
process.env.APP_URL = "http://web.test";

afterAll(async () => {
  await prisma.$disconnect();
});
