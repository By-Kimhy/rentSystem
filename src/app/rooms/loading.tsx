import { DashboardLoading } from "@/components/dashboard-shell";

// Suspense boundary for the search params and API reads on the listings page.
export default function Loading() {
  return <DashboardLoading />;
}
