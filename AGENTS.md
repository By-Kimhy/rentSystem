<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cloud Agent

Node.js 22 and Docker are installed; the database is MySQL 8.4 (switched from PostgreSQL on 2026-10-17). Start it with `dockerd &` and then the `docker run` command in `README.md` ("Running locally"), which creates the `rent` user and `rentsystem` database. If the environment start script still launches PostgreSQL, it is no longer used. Then copy `.env.example` to `.env` if it is missing, apply migrations with `npm run db:deploy`, seed demo accounts with `npm run db:seed`, and run `npm run dev` on port 3000.

`npm run db:migrate` (`prisma migrate dev`) is interactive. Use `npm run db:deploy` to apply existing migrations in this environment.

Demo accounts and the local setup commands are in `README.md`.
