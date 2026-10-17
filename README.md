# RentSystem

A web app for renting out rooms in apartments, condos and houses.

Built with Next.js 16 (App Router, TypeScript, Tailwind CSS), PostgreSQL and Prisma.

## Roles

| Role     | How the account is created                      | Home page   |
| -------- | ----------------------------------------------- | ----------- |
| Admin    | `npm run db:seed` (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`) | `/admin`    |
| Landlord | Sign-up form, choosing "Landlord"               | `/landlord` |
| Tenant   | Sign-up form, choosing "Tenant"                 | `/tenant`   |

Visiting another role's page sends you to your own. Signed-out visitors are sent to `/login`.

## Running locally

Requirements: Node.js 20+ and PostgreSQL 14+.

```bash
# 1. Create a database (adjust user/password to taste)
createuser -P rent          # password: rent
createdb -O rent rentsystem

# 2. Configure the app
cp .env.example .env
# edit DATABASE_URL if needed, and set SESSION_SECRET (openssl rand -base64 32)

# 3. Install, create tables, add the admin and demo accounts
npm install
npm run db:migrate
npm run db:seed

# 4. Start the dev server at http://localhost:3000
npm run dev
```

The seed creates these accounts (the demo landlord and tenant are skipped when `NODE_ENV=production`):

| Email                     | Password        | Role     |
| ------------------------- | --------------- | -------- |
| admin@rentsystem.local    | admin12345      | Admin    |
| landlord@rentsystem.local | landlord12345   | Landlord |
| tenant@rentsystem.local   | tenant12345     | Tenant   |

Change the admin password via `.env` before deploying anywhere public.

## How auth works

- Passwords are hashed with bcrypt. Sessions are a signed JWT (HS256, `SESSION_SECRET`) in an httpOnly cookie that lasts 7 days.
- `src/proxy.ts` does fast cookie-only redirects (signed-out users away from dashboards, signed-in users away from login).
- `src/lib/dal.ts` is the real check: `getCurrentUser()` and `requireRole(...)` load the user from the database on every protected page and should be called in every Server Action that changes data.
- Sign-up, login and logout are Server Actions in `src/app/actions/auth.ts`.

## Scripts

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Dev server                            |
| `npm run build`     | Production build                      |
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | TypeScript check                      |
| `npm run db:migrate`| Apply/create migrations (development) |
| `npm run db:deploy` | Apply migrations (production)         |
| `npm run db:seed`   | Create admin and demo accounts        |
