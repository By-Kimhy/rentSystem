# RentSystem

A web app for renting out rooms in apartments, condos and houses.

Two parts, in one repository:

| Part | Folder | Stack | Port |
| ---- | ------ | ----- | ---- |
| Web app (frontend) | `src/` | Next.js 16 (App Router, TypeScript, Tailwind CSS) | 3000 |
| API (backend) | `server/` | Node.js, Express 5, TypeScript, Prisma 6 | 4000 |
| Database | `server/prisma/` | MySQL 8 | 3306 |

The web app never touches the database. Its pages and Server Actions call the API with the visitor's session token (`src/lib/api.ts`), and Next.js forwards browser requests for `/api/*` (photos, for example) to the API, so the site works from one address. The API holds all the business rules and can serve a mobile app or another client the same way. See [API](#api) for its endpoints.

## Roles

| Role     | How the account is created                      | Home page   |
| -------- | ----------------------------------------------- | ----------- |
| Admin    | `npm run db:seed` (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`) | `/admin`    |
| Landlord | Sign-up form, choosing "Landlord"               | `/landlord` |
| Tenant   | Sign-up form, choosing "Tenant"                 | `/tenant`   |

Visiting another role's page sends you to your own. Signed-out visitors are sent to `/login`, except on the public room listings at `/rooms`.

## Running locally

Requirements: Node.js 22+ and MySQL 8+.

```bash
# 1. Create a database and user (adjust the password to taste). The user needs
#    CREATE rights so `prisma migrate dev` can make its temporary shadow database.
mysql -u root -p -e "CREATE DATABASE rentsystem; CREATE USER 'rent'@'%' IDENTIFIED BY 'rent'; GRANT ALL ON *.* TO 'rent'@'%';"
#    No MySQL installed? Run it in Docker instead:
#    docker run -d --name mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=rentsystem \
#      -e MYSQL_USER=rent -e MYSQL_PASSWORD=rent mysql:8.4
#    docker exec mysql mysql -uroot -proot -e "GRANT ALL ON *.* TO 'rent'@'%'"

# 2. Configure the app
cp .env.example .env
# edit DATABASE_URL if needed, and set SESSION_SECRET (openssl rand -base64 32)

# 3. Install (web app and API together), create tables, add the admin and demo accounts
npm install
npm run db:migrate
npm run db:seed

# 4. Start the API (http://localhost:4000) and the web app (http://localhost:3000) together
npm run dev
```

Both parts read the one `.env` at the repository root. Open http://localhost:3000.

The seed creates these accounts (the demo landlord and tenant are skipped when `NODE_ENV=production`):

| Email                     | Password        | Role     |
| ------------------------- | --------------- | -------- |
| admin@rentsystem.local    | admin12345      | Admin    |
| landlord@rentsystem.local | landlord12345   | Landlord |
| tenant@rentsystem.local   | tenant12345     | Tenant   |

Change the admin password via `.env` before deploying anywhere public.

## How auth works

- The API hashes passwords with bcrypt and signs sessions as a JWT (HS256, `SESSION_SECRET`) that lasts 7 days. Sign-up and login return the token in the body and as an httpOnly `session` cookie.
- The API accepts the token as that cookie or as `Authorization: Bearer <token>`, and re-reads the user from the database on every request (`server/src/auth.ts`). Every landlord endpoint only touches the signed-in landlord's own rows; anyone else's ids return 404.
- The web app keeps the token in its own httpOnly `session` cookie and sends it to the API as a bearer token. `src/proxy.ts` does fast cookie-only redirects; `src/lib/dal.ts` (`getCurrentUser()`, `requireRole(...)`) asks the API who is signed in.
- Sign-up, login and logout are Server Actions in `src/app/actions/auth.ts`.

## Properties and rooms

Landlords manage their listings at `/landlord/properties`:

- A property is an apartment, condo or house with an address, city, description and photos.
- Each room has a monthly rent (USD), optional size, max occupants, an availability status (available, occupied or maintenance), an optional "available from" date, and photos.
- Photos (JPEG, PNG or WebP, up to 5 MB each) are uploaded to the API, written to `UPLOAD_DIR` (default `./uploads`, relative to the repository root) and served at `GET /api/photos/:fileName`. Back this folder up, or move photos to object storage before running more than one API server.

Anyone, signed in or not, can browse available rooms at `/rooms` and filter by city, property type, rent range and number of people. Each room has its own page at `/rooms/:id` with its photos and the property's. Occupied rooms and rooms under maintenance are not listed, and their pages show "not found".

## Rental applications

A signed-in tenant can apply for a listed room from its page, giving a phone number, a move-in date (not in the past, and not before the room's "available from" date), how many people (no more than the room fits) and an optional message. Signed-out visitors are offered sign-in or sign-up, and come back to the room afterwards. A tenant can have one pending application per room, and sees all of theirs, with their status, on `/tenant`, where a pending one can be withdrawn.

The landlord reviews them under `/landlord/applications`. Declining closes the application. Approving adds the applicant to the landlord's tenants, linked to their account (an applicant approved before reuses the same tenant record), and opens the new-lease form already filled in with the room, the tenant and the move-in date. Nothing is signed until the landlord saves that lease.

## Tenants, leases and rent

Everything a landlord needs to collect rent, under `/landlord`:

| Page | What it does |
| ---- | ------------ |
| Dashboard (`/landlord`) | Billed and collected this month, money outstanding and overdue, overdue invoices by days late, leases ending in the next 60 days |
| Tenants | Tenant profiles (contact, ID, emergency contact), search, balance owed and credit, lease, invoice and payment history |
| Leases | Rent one room to one or more tenants, with start and end dates (blank end = month-to-month), rent, due day, deposit, grace days and late fee. Save as draft or activate; renew; end on a chosen day |
| Invoices | Every invoice with its status, a printable invoice page ("Print or save PDF"), extra lines, voiding with a reason |
| Payments | Record cash, bank transfer, card or mobile wallet payments, see printable receipts, reverse mistakes |

How billing works (`server/src/lib/billing.ts`):

- **Activating a lease** checks no other active lease on that room overlaps its dates, marks the room occupied and bills the deposit on its own invoice.
- **Rent invoices** are created automatically for each calendar month, 7 days before the due day. The first and last months are prorated by days occupied.
- **Payments** pay the oldest unpaid invoice first unless you split them by hand. Anything left over stays as credit and pays the next invoice automatically. A reversal records a matching negative payment, so nothing is ever deleted.
- **Overdue**: an invoice unpaid after its due date plus the lease's grace days (default 3) turns overdue, and the lease's late fee (flat amount or percent of rent) is added once.
- **Ending a lease** frees the room, prorates the final month and voids untouched invoices after it. Then the lease page settles the deposit: record deductions with reasons and the refund until nothing is held.
- Billing is brought up to date whenever a landlord opens a rent page. To keep statuses current overnight too, call `POST http://localhost:4000/api/cron/billing` once a day with `Authorization: Bearer $CRON_SECRET` (for example from cron or a GitHub Actions schedule).
- Set `BILLING_TIMEZONE` (for example `Asia/Phnom_Penh`) so the day rolls over at local midnight. It defaults to UTC.

A whole house or condo rented to one household is set up as a property with a single room.

## API

All endpoints are under `/api` on port 4000. Bodies are JSON (or multipart where photos can be attached, in a `photos` file field). Errors come back as `{ "error": "...", "fieldErrors": { "field": ["..."] } }` with status 400 (invalid input), 401 (not signed in), 403 (wrong role), 404 (not found or not yours) or 409 (not allowed in the current state). Response shapes are typed in `server/src/contract.ts`; money is a decimal string such as `"260.00"` and dates are ISO strings.

| Area | Endpoints |
| ---- | --------- |
| Accounts | `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Public | `GET /rooms?city=&type=&minRent=&maxRent=&occupants=` (available rooms), `GET /rooms/:id`, `GET /photos/:fileName`, `GET /health` |
| Admin | `GET /admin/users` |
| Landlord dashboard | `GET /landlord/dashboard` |
| Properties and rooms | `GET, POST /landlord/properties`, `GET, PUT, DELETE /landlord/properties/:id`, `POST /landlord/properties/:id/rooms`, `GET, PUT, DELETE /landlord/rooms/:id`, `DELETE /landlord/photos/:id` |
| Tenants | `GET /landlord/tenants?q=`, `POST /landlord/tenants`, `GET, PUT, DELETE /landlord/tenants/:id` |
| Leases | `GET /landlord/leases?show=ACTIVE\|DRAFT\|ending\|past`, `GET /landlord/leases/options`, `POST /landlord/leases`, `GET, PUT, DELETE /landlord/leases/:id`, `POST /landlord/leases/:id/activate`, `.../end`, `.../renew`, `.../charges`, `.../deposit-transactions` |
| Invoices | `GET /landlord/invoices?show=overdue\|paid\|void\|all`, `GET /landlord/invoices/:id`, `POST /landlord/invoices/:id/lines`, `POST /landlord/invoices/:id/void` |
| Payments | `GET /landlord/payments`, `GET /landlord/payments/options?lease=`, `POST /landlord/payments`, `GET /landlord/payments/:id`, `POST /landlord/payments/:id/reverse` |
| Applications (tenant) | `GET, POST /tenant/applications`, `POST /tenant/applications/:id/withdraw` |
| Applications (landlord) | `GET /landlord/applications?show=all`, `GET /landlord/applications/:id`, `POST /landlord/applications/:id/approve`, `.../reject` |
| Billing job | `POST /cron/billing` with `Authorization: Bearer $CRON_SECRET` |

Saving a lease with `"intent": "activate"` activates it straight away; if the room is already let for those dates the draft is still saved and the response carries `activationError`. A payment may include `"allocations": { "<invoiceId>": "100.00" }` to split it by hand.

Quick try with curl:

```bash
curl -c jar -H 'Content-Type: application/json' -d '{"email":"landlord@rentsystem.local","password":"landlord12345"}' localhost:4000/api/auth/login
curl -b jar localhost:4000/api/landlord/dashboard
```

## Scripts

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | API and web app dev servers together                 |
| `npm run dev:api`, `npm run dev:web` | Just one of them                    |
| `npm run build`     | Production build of both                             |
| `npm start`         | Run both production builds                           |
| `npm run lint`      | ESLint                                               |
| `npm run typecheck` | TypeScript check of both                             |
| `npm test`          | API tests (they use the database in `DATABASE_URL`)  |
| `npm run db:migrate`| Apply/create migrations (development)                |
| `npm run db:deploy` | Apply migrations (production)                        |
| `npm run db:seed`   | Create admin and demo accounts                       |

To run the parts on different hosts, set `API_URL` for the web app (where it finds the API), and `API_PORT` and `CORS_ORIGINS` for the API. Both need the same `SESSION_SECRET`.
