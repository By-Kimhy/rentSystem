import Link from "next/link";
import { Suspense } from "react";
import type { MyApplication } from "@api/contract";
import { withdrawApplication } from "./actions";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_STYLES, formatDate, formatRent } from "@/lib/format";
import { DashboardLoading, DashboardShell } from "@/components/dashboard-shell";
import { ConfirmButton } from "@/components/landlord/ConfirmButton";
import { Badge, EmptyState, cardClass, linkClass } from "@/components/landlord/ui";

export const metadata = { title: "Tenant dashboard · RentSystem" };

const NEXT_STEP: Record<MyApplication["status"], string> = {
  PENDING: "Waiting for the landlord to review it.",
  APPROVED: "Approved. The landlord will contact you to sign the lease.",
  REJECTED: "The landlord declined this application.",
  WITHDRAWN: "You withdrew this application.",
};

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
  const { applications } = await apiGet<{ applications: MyApplication[] }>("/tenant/applications");

  return (
    <div className="space-y-6">
      <p>Welcome, {user.name}.</p>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">My applications</h2>
          <Link href="/rooms" className={linkClass}>
            Browse rooms
          </Link>
        </div>
        {applications.length === 0 ? (
          <EmptyState>
            You haven&apos;t applied for a room yet.{" "}
            <Link href="/rooms" className={linkClass}>
              Find one to rent
            </Link>
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {applications.map((a) => (
              <li key={a.id} className={`${cardClass} flex flex-wrap items-start justify-between gap-4 p-4`}>
                <div className="space-y-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {a.room.status === "AVAILABLE" ? (
                      <Link href={`/rooms/${a.room.id}`} className="hover:underline">
                        {a.room.name}, {a.room.property.name}
                      </Link>
                    ) : (
                      <span>
                        {a.room.name}, {a.room.property.name}
                      </span>
                    )}
                    <Badge className={APPLICATION_STATUS_STYLES[a.status]}>{APPLICATION_STATUS_LABELS[a.status]}</Badge>
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {a.room.property.city} · {formatRent(a.room.rentPrice)} / month · Move in {formatDate(a.moveInDate)} ·{" "}
                    {a.occupants === 1 ? "1 person" : `${a.occupants} people`}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Applied {formatDate(a.createdAt)}. {NEXT_STEP[a.status]}
                  </p>
                </div>
                {a.status === "PENDING" && (
                  <ConfirmButton action={withdrawApplication.bind(null, a.id)} message="Withdraw this application?">
                    Withdraw
                  </ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
