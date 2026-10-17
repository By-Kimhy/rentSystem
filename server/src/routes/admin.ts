import { Router } from "express";
import { currentUser, requireRole } from "../auth.js";
import { adminPropertySelect, userListSelect } from "../contract.js";
import { prisma } from "../db.js";
import { HttpError } from "../errors.js";
import { syncBilling } from "../lib/billing.js";
import { addDays, nextPeriod, periodOf, periodStart, today } from "../lib/dates.js";
import { toCents } from "../lib/money.js";
import { sendInvoiceReminders } from "../lib/reminders.js";

export const adminRouter = Router();
adminRouter.use(requireRole("ADMIN"));

const LIST_LIMIT = 50;
const searchTerm = (q: unknown) => (typeof q === "string" ? q.trim().slice(0, 100) : "");

// GET /users?q=  Newest first, at most 50; `total` counts every match.
adminRouter.get("/users", async (req, res) => {
  const q = searchTerm(req.query.q);
  const where = q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {};
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, select: userListSelect, take: LIST_LIMIT }),
    prisma.user.count({ where }),
  ]);
  res.json({ users, total });
});

// Platform totals: accounts, listings, leases, and this month's rent across every landlord.
adminRouter.get("/overview", async (_req, res) => {
  const now = today();
  const monthStart = periodStart(periodOf(now));
  const monthEnd = addDays(periodStart(nextPeriod(periodOf(now))), -1);
  const [landlords, tenants, disabled, properties, rooms, occupied, available, activeLeases, pendingApplications, billed, collected] =
    await Promise.all([
      prisma.user.count({ where: { role: "LANDLORD" } }),
      prisma.user.count({ where: { role: "TENANT" } }),
      prisma.user.count({ where: { disabledAt: { not: null } } }),
      prisma.property.count(),
      prisma.room.count(),
      prisma.room.count({ where: { status: "OCCUPIED" } }),
      prisma.room.count({ where: { status: "AVAILABLE" } }),
      prisma.lease.count({ where: { status: "ACTIVE" } }),
      prisma.application.count({ where: { status: "PENDING" } }),
      prisma.invoice.aggregate({
        where: { status: { not: "VOID" }, dueDate: { gte: monthStart, lte: monthEnd } },
        _sum: { total: true },
      }),
      prisma.payment.aggregate({ where: { paidOn: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
    ]);
  res.json({
    users: { landlords, tenants, disabled },
    properties,
    rooms: { total: rooms, occupied, available },
    activeLeases,
    pendingApplications,
    billedCents: toCents(billed._sum.total?.toFixed(2) ?? 0),
    collectedCents: toCents(collected._sum.amount?.toFixed(2) ?? 0),
  });
});

// GET /properties?q=  By property name, city or landlord; newest first, at most 50.
adminRouter.get("/properties", async (req, res) => {
  const q = searchTerm(req.query.q);
  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { city: { contains: q } },
          { landlord: { name: { contains: q } } },
          { landlord: { email: { contains: q } } },
        ],
      }
    : {};
  const [properties, total] = await Promise.all([
    prisma.property.findMany({ where, orderBy: { createdAt: "desc" }, select: adminPropertySelect, take: LIST_LIMIT }),
    prisma.property.count({ where }),
  ]);
  res.json({ properties, total });
});

// Disabling signs the account out everywhere (see loadUser) and blocks new sign-ins. Admin
// accounts can't be disabled here, so an admin can't lock everyone out by mistake.
async function setDisabled(id: string, adminId: string, disabled: boolean) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user) throw new HttpError(404, "User not found.");
  if (user.role === "ADMIN" || user.id === adminId) throw new HttpError(409, "Admin accounts can't be disabled.");
  return prisma.user.update({ where: { id }, data: { disabledAt: disabled ? new Date() : null }, select: userListSelect });
}

adminRouter.post("/users/:id/disable", async (req, res) => {
  res.json({ user: await setDisabled(req.params.id, currentUser(req).id, true) });
});

adminRouter.post("/users/:id/enable", async (req, res) => {
  res.json({ user: await setDisabled(req.params.id, currentUser(req).id, false) });
});

// Daily billing run for a scheduler (cron, GitHub Actions…):
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:4000/api/cron/billing
// The rent endpoints also bring billing up to date whenever a landlord opens them, but the
// invoice reminder emails (lib/reminders.ts) only go out from here, so run it daily.
export const cronRouter = Router();

cronRouter.all("/billing", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get("authorization") !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  await syncBilling();
  const reminders = await sendInvoiceReminders();
  res.json({ ok: true, reminders });
});
