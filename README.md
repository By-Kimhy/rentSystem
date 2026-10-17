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

## Properties and rooms

Landlords manage their listings at `/landlord/properties`:

- A property is an apartment, condo or house with an address, city, description and photos.
- Each room has a monthly rent (USD), optional size, max occupants, an availability status (available, occupied or maintenance), an optional "available from" date, and photos.
- Every page and Server Action in `src/app/landlord/properties` checks `requireRole("LANDLORD")` and only touches the signed-in landlord's own rows.
- Photos (JPEG, PNG or WebP, up to 5 MB each) are written to `UPLOAD_DIR` (default `./uploads`) and served by `src/app/api/photos/[fileName]/route.ts`. Back this folder up, or move photos to object storage before running more than one server.

## Tenants, leases and rent

Everything a landlord needs to collect rent, under `/landlord`:

| Page | What it does |
| ---- | ------------ |
| Dashboard (`/landlord`) | Billed and collected this month, money outstanding and overdue, overdue invoices by days late, leases ending in the next 60 days |
| Tenants | Tenant profiles (contact, ID, emergency contact), search, balance owed and credit, lease, invoice and payment history |
| Leases | Rent one room to one or more tenants, with start and end dates (blank end = month-to-month), rent, due day, deposit, grace days and late fee. Save as draft or activate; renew; end on a chosen day |
| Invoices | Every invoice with its status, a printable invoice page ("Print or save PDF"), extra lines, voiding with a reason |
| Payments | Record cash, bank transfer, card or mobile wallet payments, see printable receipts, reverse mistakes |

How billing works (`src/lib/billing.ts`):

- **Activating a lease** checks no other active lease on that room overlaps its dates, marks the room occupied and bills the deposit on its own invoice.
- **Rent invoices** are created automatically for each calendar month, 7 days before the due day. The first and last months are prorated by days occupied.
- **Payments** pay the oldest unpaid invoice first unless you split them by hand. Anything left over stays as credit and pays the next invoice automatically. A reversal records a matching negative payment, so nothing is ever deleted.
- **Overdue**: an invoice unpaid after its due date plus the lease's grace days (default 3) turns overdue, and the lease's late fee (flat amount or percent of rent) is added once.
- **Ending a lease** frees the room, prorates the final month and voids untouched invoices after it. Then the lease page settles the deposit: record deductions with reasons and the refund until nothing is held.
- Billing is brought up to date whenever a landlord opens a rent page. To keep statuses current overnight too, call `GET /api/cron/billing` once a day with `Authorization: Bearer $CRON_SECRET` (for example from cron, Vercel Cron or a GitHub Actions schedule).
- Set `BILLING_TIMEZONE` (for example `Asia/Phnom_Penh`) so the day rolls over at local midnight. It defaults to UTC.

A whole house or condo rented to one household is set up as a property with a single room.

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
