import { DashboardLoading } from "@/components/dashboard-shell";

// Suspense boundary for the session and API reads on this page.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <DashboardLoading />
    </div>
  );
}
