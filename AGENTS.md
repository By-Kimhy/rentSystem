<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cloud Agent

Node.js 22 and PostgreSQL 16 are already installed. On boot, the environment start script launches PostgreSQL, creates the `rent` role and `rentsystem` database when they are missing, copies `.env.example` to `.env` when `.env` is absent, applies migrations with `npm run db:deploy`, seeds demo accounts, and runs `npm run dev` on port 3000.

`npm run db:migrate` (`prisma migrate dev`) is interactive. Use `npm run db:deploy` to apply existing migrations in this environment.

Demo accounts and the local setup commands are in `README.md`.
