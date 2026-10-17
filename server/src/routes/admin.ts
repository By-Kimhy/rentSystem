import { Router } from "express";
import { requireRole } from "../auth.js";
import { userListSelect } from "../contract.js";
import { prisma } from "../db.js";
import { syncBilling } from "../lib/billing.js";

export const adminRouter = Router();
adminRouter.use(requireRole("ADMIN"));

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: userListSelect });
  res.json({ users });
});

// Daily billing run for a scheduler (cron, GitHub Actions…):
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:4000/api/cron/billing
// The rent endpoints also bring billing up to date whenever a landlord opens them,
// so this only matters for keeping statuses current while nobody is looking.
export const cronRouter = Router();

cronRouter.all("/billing", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get("authorization") !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  await syncBilling();
  res.json({ ok: true });
});
