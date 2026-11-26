import { DashboardLoading } from "@/components/dashboard-shell";

// Suspense boundary for the API reads on this page.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-md py-16">
      <DashboardLoading />
    </div>
  );
}
