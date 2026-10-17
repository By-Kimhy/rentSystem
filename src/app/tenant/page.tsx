import Link from "next/link";
import { Suspense } from "react";
import type { MyApplication, TenantHome } from "@api/contract";
import { withdrawApplication } from "./actions";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_STYLES,
  LEASE_STATUS_LABELS,
  describeLateFee,
  formatDate,
  formatRent,
  ordinal,
} from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";
import { DashboardLoading, DashboardShell } from "@/components/dashboard-shell";
import { ConfirmButton } from "@/components/landlord/ConfirmButton";
import { InvoiceTable } from "@/components/landlord/InvoiceTable";
import { PaymentTable } from "@/components/landlord/PaymentTable";
import { Badge, Details, EmptyState, cardClass, linkClass } from "@/components/landlord/ui";

export const metadata = { title: "Tenant dashboard · RentSystem" };

const NEXT_STEP: Record<MyApplication["status"], string> = {
  PENDING: "Waiting for the landlord to review it.",
  APPROVED: "Approved. Your landlord will set up the lease with you.",
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
  const [home, { applications }] = await Promise.all([
    apiGet<TenantHome>("/tenant/home"),
    apiGet<{ applications: MyApplication[] }>("/tenant/applications"),
  ]);
  const active = home.leases.filter((l) => l.status === "ACTIVE");
  const past = home.leases.filter((l) => l.status !== "ACTIVE");
  const leasedRooms = new Set(home.leases.map((l) => l.roomId));

  return (
    <div className="space-y-10">
      <p>Welcome, {user.name}.</p>

      {active.length === 0 ? (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">My rental</h2>
          <EmptyState>
            {past.length > 0
              ? "You have no current lease."
              : "When a landlord approves your application and starts your lease, it will show here."}
          </EmptyState>
        </section>
      ) : (
        <>
          {active.map((lease) => (
            <RentalCard key={lease.id} lease={lease} />
          ))}
          <Balance home={home} />
        </>
      )}

      {home.leases.length > 0 && (
        <>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Invoices</h2>
            <InvoiceTable invoices={home.invoices} basePath="/tenant/invoices" />
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Payments</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Payments appear here once your landlord records them.
            </p>
            <PaymentTable payments={home.payments} linked={false} />
          </section>
        </>
      )}

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Past leases</h2>
          <ul className={`${cardClass} divide-y divide-zinc-200 text-sm dark:divide-zinc-800`}>
            {past.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 p-4">
                <span>
                  {l.room.name}, {l.room.property.name}
                </span>
                <span className="text-zinc-500">
                  {formatDate(l.startDate)} to {formatDate(l.terminatedOn ?? l.endDate ?? l.startDate)} ·{" "}
                  {LEASE_STATUS_LABELS[l.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
                    Applied {formatDate(a.createdAt)}.{" "}
                    {a.status === "APPROVED" && leasedRooms.has(a.room.id)
                      ? "Approved. Your lease is shown above."
                      : NEXT_STEP[a.status]}
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

type HomeLease = TenantHome["leases"][number];

function RentalCard({ lease }: { lease: HomeLease }) {
  const { property } = lease.room;
  const others = lease.tenants.slice(1).map((t) => t.tenant.fullName);
  return (
    <section className={`${cardClass} space-y-5 p-6`}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">My rental</p>
        <h2 className="text-xl font-semibold">
          {lease.room.name}, {property.name}
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          {property.address}, {property.city}
        </p>
      </div>
      <Details
        items={[
          ["Rent", `${formatRent(lease.rentAmount)} per month`],
          ["Due", `On the ${ordinal(lease.dueDay)} of each month`],
          [
            "Lease",
            lease.endDate
              ? `${formatDate(lease.startDate)} to ${formatDate(lease.endDate)}`
              : `From ${formatDate(lease.startDate)}, month to month`,
          ],
          ["Deposit held", formatRent(Number(fromCents(lease.depositHeldCents)))],
          [
            "Late fee",
            lease.lateFeeType === "NONE"
              ? "None"
              : `${describeLateFee(lease.lateFeeType, lease.lateFeeValue)}, after ${lease.graceDays} days' grace`,
          ],
          [
            "Landlord",
            <a key="landlord" href={`mailto:${property.landlord.email}`} className={linkClass}>
              {property.landlord.name}
            </a>,
          ],
          ...(others.length > 0 ? ([["Sharing with", others.join(", ")]] as [string, string][]) : []),
        ]}
      />
    </section>
  );
}

function Balance({ home }: { home: TenantHome }) {
  const unpaid = home.invoices
    .filter((i) => ["OPEN", "PARTIAL", "OVERDUE"].includes(i.status))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const owedCents = unpaid.reduce((s, i) => s + toCents(i.total) - toCents(i.amountPaid), 0);
  const overdue = unpaid.some((i) => i.status === "OVERDUE");
  const next = unpaid[0];
  const creditCents = home.leases.reduce((s, l) => s + l.creditCents, 0);

  const tiles: [string, string, string?][] = [
    [
      "Balance due",
      formatRent(Number(fromCents(owedCents))),
      overdue ? "Includes overdue invoices" : owedCents === 0 ? "You're all paid up" : undefined,
    ],
    [
      "Next due",
      next ? formatDate(next.dueDate) : "Nothing due",
      next ? formatRent(Number(fromCents(toCents(next.total) - toCents(next.amountPaid)))) : undefined,
    ],
  ];
  if (creditCents > 0) tiles.push(["Credit", formatRent(Number(fromCents(creditCents))), "Used on your next invoice"]);

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {tiles.map(([label, value, note]) => (
        <div key={label} className={`${cardClass} p-4`}>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
          <p
            className={`text-2xl font-semibold ${label === "Balance due" && overdue ? "text-red-600 dark:text-red-400" : ""}`}
          >
            {value}
          </p>
          {note && <p className="text-sm text-zinc-500">{note}</p>}
        </div>
      ))}
    </section>
  );
}
