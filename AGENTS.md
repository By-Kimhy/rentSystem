<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Layout

Next.js web app in `src/` (port 3000) and an Express API in `server/` (port 4000), as npm workspaces from the root. Only the API touches the database: Prisma schema and migrations are in `server/prisma/`, business rules in `server/src/lib/`, routes in `server/src/routes/`, and the response types both sides share in `server/src/contract.ts`. Web pages read through `apiGet` and Server Actions write through `api` in `src/lib/api.ts`. `npm run dev` starts both.

## Cloud Agent

Node.js 22 is installed; the database is MySQL 8. The SessionStart hook `.claude/hooks/session-start.sh` gets each cloud session ready: it installs MySQL from apt if needed (Docker Hub pulls are rate-limited here) and starts it, creates the `rent` user and `rentsystem` database, copies `.env.example` to `.env` with a random `SESSION_SECRET` if `.env` is missing, runs `npm install`, applies migrations with `npm run db:deploy` and seeds demo accounts with `npm run db:seed`. If the environment start script still launches PostgreSQL, it is no longer used. If MySQL has stopped (for example after the container restarts), run `service mysql start` or the hook again. Run `npm run dev` yourself when you need the app (API on 4000, web app on 3000). `npm test` runs the API tests against that database.

`npm run db:migrate` (`prisma migrate dev`) is interactive. Use `npm run db:deploy` to apply existing migrations in this environment.

Demo accounts and the local setup commands are in `README.md`.
