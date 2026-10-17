import Link from "next/link";
import { Suspense } from "react";
import { daysOverdue, syncBilling } from "@/lib/billing";
import { requireRole } from "@/lib/dal";
import { addDays, nextPeriod, periodOf, periodStart, today } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatDate, formatRent, invoiceNumber } from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";
import { DashboardLoading, DashboardShell } from "@/components/dashboard-shell";
import { invoiceLabel } from "@/components/landlord/InvoiceTable";
import { EmptyState, cardClass, linkClass, primaryButtonClass, secondaryButtonClass } from "@/components/landlord/ui";

export const metadata = { title: "Landlord dashboard · RentSystem" };

export default function LandlordPage() {
  return (
    <DashboardShell title="Rent dashboard">
      <Suspense fallback={<DashboardLoading />}>
        <LandlordContent />
      </Suspense>
    </DashboardShell>
  );
}

const usd = (cents: number) => formatRent(Number(fromCents(cents)));

async function LandlordContent() {
  const user = await requireRole("LANDLORD");
  await syncBilling(user.id);
  const now = today();
  const monthStart = periodStart(periodOf(now));
  const monthEnd = addDays(periodStart(nextPeriod(periodOf(now))), -1);
  const mine = { lease: { room: { property: { landlordId: user.id } } } };

  const [rooms, occupied, billed, collected, unpaid, ending] = await Promise.all([
    prisma.room.count({ where: { property: { landlordId: user.id } } }),
    prisma.room.count({ where: { property: { landlordId: user.id }, status: "OCCUPIED" } }),
    prisma.invoice.aggregate({
      where: { ...mine, status: { not: "VOID" }, dueDate: { gte: monthStart, lte: monthEnd } },
      _sum: { total: true },
    }),
    prisma.payment.aggregate({ where: { ...mine, paidOn: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
    prisma.invoice.findMany({
      where: { ...mine, status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } },
      orderBy: [{ dueDate: "asc" }, { number: "asc" }],
      include: {
        lease: {
          select: {
            id: true,
            room: { select: { name: true, property: { select: { name: true } } } },
            tenants: { where: { isPrimary: true }, select: { tenant: { select: { id: true, fullName: true, phone: true } } } },
          },
        },
      },
    }),
    prisma.lease.findMany({
      where: {
        room: { property: { landlordId: user.id } },
        status: "ACTIVE",
        endDate: { gte: now, lte: addDays(now, 60) },
        renewedBy: null,
      },
      orderBy: { endDate: "asc" },
      include: {
        room: { select: { name: true, property: { select: { name: true } } } },
        tenants: { where: { isPrimary: true }, select: { tenant: { select: { fullName: true } } } },
      },
    }),
  ]);

  const balance = (i: (typeof unpaid)[number]) => toCents(i.total) - toCents(i.amountPaid);
  const overdue = unpaid.filter((i) => i.status === "OVERDUE");
  const outstandingCents = unpaid.reduce((s, i) => s + balance(i), 0);
  const overdueCents = overdue.reduce((s, i) => s + balance(i), 0);

  const tiles = [
    { label: "Billed this month", value: usd(toCents(billed._sum.total ?? 0)) },
    { label: "Collected this month", value: usd(toCents(collected._sum.amount ?? 0)) },
    { label: "Outstanding", value: usd(outstandingCents) },
    { label: "Overdue", value: usd(overdueCents), alert: overdueCents > 0 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-zinc-600 dark:text-zinc-400">
          Welcome, {user.name}. {occupied} of {rooms} {rooms === 1 ? "room" : "rooms"} let.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/landlord/payments/new" className={primaryButtonClass}>
            Record payment
          </Link>
          <Link href="/landlord/leases/new" className={secondaryButtonClass}>
            New lease
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={`${cardClass} p-4`}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${t.alert ? "text-red-600 dark:text-red-400" : ""}`}>{t.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Overdue</h2>
          <Link href="/landlord/invoices?show=overdue" className={linkClass}>
            All overdue invoices
          </Link>
        </div>
        {overdue.length === 0 ? (
          <EmptyState>Nothing is overdue.</EmptyState>
        ) : (
          <ul className={`${cardClass} divide-y divide-zinc-200 dark:divide-zinc-800`}>
            {[...overdue]
              .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
              .map((i) => {
                const tenant = i.lease.tenants[0]?.tenant;
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {tenant ? (
                          <Link href={`/landlord/tenants/${tenant.id}`} className="hover:underline">
                            {tenant.fullName}
                          </Link>
                        ) : (
                          "Unknown tenant"
                        )}{" "}
                        <span className="font-normal text-zinc-500">{tenant?.phone}</span>
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        <Link href={`/landlord/invoices/${i.id}`} className="hover:underline">
                          {invoiceNumber(i.number)}
                        </Link>{" "}
                        · {invoiceLabel(i)} · {i.lease.room.name}, {i.lease.room.property.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{usd(balance(i))}</p>
                      <p className="text-sm text-red-600 dark:text-red-400">{daysOverdue(i.dueDate, now)} days late</p>
                    </div>
                    <Link href={`/landlord/payments/new?lease=${i.lease.id}`} className={secondaryButtonClass}>
                      Record payment
                    </Link>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Leases ending in the next 60 days</h2>
        {ending.length === 0 ? (
          <EmptyState>No leases ending soon.</EmptyState>
        ) : (
          <ul className={`${cardClass} divide-y divide-zinc-200 dark:divide-zinc-800`}>
            {ending.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <Link href={`/landlord/leases/${l.id}`} className="font-medium hover:underline">
                  {l.tenants[0]?.tenant.fullName} · {l.room.name}, {l.room.property.name}
                </Link>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Ends {formatDate(l.endDate!)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
