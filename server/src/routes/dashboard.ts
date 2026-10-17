import { Router } from "express";
import { currentUser } from "../auth.js";
import { UNPAID, dashboardEndingInclude, dashboardUnpaidInclude } from "../contract.js";
import { prisma } from "../db.js";
import { syncBilling } from "../lib/billing.js";
import { addDays, nextPeriod, periodOf, periodStart, today } from "../lib/dates.js";
import { toCents } from "../lib/money.js";

export const dashboardRouter = Router();

// This month's money, every unpaid invoice, and leases ending in the next 60 days.
dashboardRouter.get("/dashboard", async (req, res) => {
  const landlordId = currentUser(req).id;
  await syncBilling(landlordId);
  const now = today();
  const monthStart = periodStart(periodOf(now));
  const monthEnd = addDays(periodStart(nextPeriod(periodOf(now))), -1);
  const mine = { lease: { room: { property: { landlordId } } } };

  const [rooms, occupied, billed, collected, unpaid, ending] = await Promise.all([
    prisma.room.count({ where: { property: { landlordId } } }),
    prisma.room.count({ where: { property: { landlordId }, status: "OCCUPIED" } }),
    prisma.invoice.aggregate({
      where: { ...mine, status: { not: "VOID" }, dueDate: { gte: monthStart, lte: monthEnd } },
      _sum: { total: true },
    }),
    prisma.payment.aggregate({ where: { ...mine, paidOn: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
    prisma.invoice.findMany({
      where: { ...mine, status: { in: [...UNPAID] } },
      orderBy: [{ dueDate: "asc" }, { number: "asc" }],
      include: dashboardUnpaidInclude,
    }),
    prisma.lease.findMany({
      where: {
        room: { property: { landlordId } },
        status: "ACTIVE",
        endDate: { gte: now, lte: addDays(now, 60) },
        renewedBy: null,
      },
      orderBy: { endDate: "asc" },
      include: dashboardEndingInclude,
    }),
  ]);

  res.json({
    rooms,
    occupied,
    billedCents: toCents(billed._sum.total ?? 0),
    collectedCents: toCents(collected._sum.amount ?? 0),
    unpaid,
    ending,
  });
});
