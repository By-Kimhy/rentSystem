import { Suspense } from "react";
import { requireRole } from "@/lib/dal";
import { DashboardLoading, DashboardShell } from "@/components/dashboard-shell";

export const metadata = { title: "Tenant dashboard · RentSystem" };

export default function TenantPage() {
  return (
    <DashboardShell title="Tenant dashboard">
      <Suspense fallback={<DashboardLoading />}>
        <TenantContent />
      </Suspense>
    </DashboardShell>
  );
}

async function TenantContent() {
  const user = await requireRole("TENANT");
  return (
    <div className="flex flex-col gap-2">
      <p>Welcome, {user.name}.</p>
      <p className="text-zinc-600 dark:text-zinc-400">Your rentals and applications will appear here.</p>
    </div>
  );
}
