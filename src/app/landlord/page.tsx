import { Suspense } from "react";
import { requireRole } from "@/lib/dal";
import { DashboardLoading, DashboardShell } from "@/components/dashboard-shell";

export const metadata = { title: "Landlord dashboard · RentSystem" };

export default function LandlordPage() {
  return (
    <DashboardShell title="Landlord dashboard">
      <Suspense fallback={<DashboardLoading />}>
        <LandlordContent />
      </Suspense>
    </DashboardShell>
  );
}

async function LandlordContent() {
  const user = await requireRole("LANDLORD");
  return (
    <div className="flex flex-col gap-2">
      <p>Welcome, {user.name}.</p>
      <p className="text-zinc-600 dark:text-zinc-400">Your properties and rooms will appear here.</p>
    </div>
  );
}
