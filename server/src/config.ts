import path from "node:path";
import { fileURLToPath } from "node:url";

// The repository root, from both src/ (tsx) and dist/ (built). Relative paths in .env resolve from here.
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  // Comma-separated list of browser origins allowed to call the API with cookies.
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  production: process.env.NODE_ENV === "production",
  sessionSecret: () => required("SESSION_SECRET"),
  uploadDir: () => path.resolve(repoRoot, process.env.UPLOAD_DIR ?? "./uploads"),
};
