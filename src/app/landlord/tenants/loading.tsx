import { DashboardLoading } from "@/components/dashboard-shell";

// Suspense boundary for the session and database reads in every tenants page.
export default function Loading() {
  return <DashboardLoading />;
}
