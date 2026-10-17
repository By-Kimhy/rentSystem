import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadUser, requireRole } from "./auth.js";
import { config } from "./config.js";
import { errorHandler, notFound } from "./errors.js";
import { adminRouter, cronRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { invoicesRouter } from "./routes/invoices.js";
import { leasesRouter } from "./routes/leases.js";
import { paymentsRouter } from "./routes/payments.js";
import { propertiesRouter } from "./routes/properties.js";
import { publicRouter } from "./routes/public.js";
import { tenantsRouter } from "./routes/tenants.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // The web app shows API photos from another origin in development.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(loadUser);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/cron", cronRouter);

  const landlord = express.Router();
  landlord.use(requireRole("LANDLORD"));
  landlord.use(dashboardRouter, propertiesRouter, tenantsRouter, leasesRouter, invoicesRouter, paymentsRouter);
  app.use("/api/landlord", landlord);

  app.use("/api", publicRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
