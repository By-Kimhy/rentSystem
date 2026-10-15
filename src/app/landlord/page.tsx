import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
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
  const [properties, rooms, available] = await Promise.all([
    prisma.property.count({ where: { landlordId: user.id } }),
    prisma.room.count({ where: { property: { landlordId: user.id } } }),
    prisma.room.count({ where: { property: { landlordId: user.id }, status: "AVAILABLE" } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <p>Welcome, {user.name}.</p>
      <p className="text-zinc-600 dark:text-zinc-400">
        You have {properties} {properties === 1 ? "property" : "properties"} with {rooms}{" "}
        {rooms === 1 ? "room" : "rooms"}, {available} available.
      </p>
      <Link href="/landlord/properties" className="font-medium underline">
        Manage properties and rooms
      </Link>
    </div>
  );
}
