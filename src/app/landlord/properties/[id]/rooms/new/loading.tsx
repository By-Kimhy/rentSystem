import { DashboardLoading } from "@/components/dashboard-shell";

// Suspense boundary for the session and database reads on this page.
export default function Loading() {
  return <DashboardLoading />;
}
