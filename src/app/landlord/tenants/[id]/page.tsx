import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTenant } from "../actions";
import { syncBilling, leaseCreditCents } from "@/lib/billing";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import {
  LEASE_STATUS_LABELS,
  LEASE_STATUS_STYLES,
  TENANT_STATUS_STYLES,
  formatDate,
  formatRent,
  tenantStatus,
} from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";
import { ConfirmButton } from "@/components/landlord/ConfirmButton";
import { InvoiceTable } from "@/components/landlord/InvoiceTable";
import { PaymentTable } from "@/components/landlord/PaymentTable";
import {
  Badge,
  BackLink,
  Details,
  EmptyState,
  cardClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/landlord/ui";

export default async function TenantPage({ params }: PageProps<"/landlord/tenants/[id]">) {
  const { id } = await params;
  const landlord = await requireRole("LANDLORD");
  await syncBilling(landlord.id);
  const tenant = await prisma.tenant.findFirst({
    where: { id, landlordId: landlord.id },
    include: {
      leases: {
        orderBy: { lease: { startDate: "desc" } },
        include: { lease: { include: { room: { include: { property: { select: { name: true } } } } } } },
      },
    },
  });
  if (!tenant) notFound();

  const leaseIds = tenant.leases.map((l) => l.leaseId);
  const [invoices, payments, credits] = await Promise.all([
    prisma.invoice.findMany({ where: { leaseId: { in: leaseIds } }, orderBy: [{ dueDate: "desc" }, { number: "desc" }] }),
    prisma.payment.findMany({
      where: { leaseId: { in: leaseIds } },
      orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
      include: { payer: { select: { fullName: true } } },
    }),
    Promise.all(leaseIds.map((leaseId) => leaseCreditCents(leaseId))),
  ]);
  const owed = invoices
    .filter((i) => ["OPEN", "PARTIAL", "OVERDUE"].includes(i.status))
    .reduce((s, i) => s + toCents(i.total) - toCents(i.amountPaid), 0);
  const credit = credits.reduce((s, c) => s + c, 0);
  const status = tenantStatus(tenant.leases.map((l) => l.lease.status));
  const activeLease = tenant.leases.find((l) => l.lease.status === "ACTIVE")?.lease;

  return (
    <div className="space-y-8">
      <BackLink href="/landlord/tenants">Tenants</BackLink>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{tenant.fullName}</h1>
              <Badge className={TENANT_STATUS_STYLES[status]}>{status}</Badge>
            </div>
            {activeLease && (
              <p className="text-zinc-600 dark:text-zinc-400">
                {activeLease.room.name}, {activeLease.room.property.name}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {activeLease && (
              <Link href={`/landlord/payments/new?lease=${activeLease.id}`} className={primaryButtonClass}>
                Record payment
              </Link>
            )}
            <Link href={`/landlord/leases/new?tenant=${tenant.id}`} className={secondaryButtonClass}>
              New lease
            </Link>
            <Link href={`/landlord/tenants/${tenant.id}/edit`} className={linkClass}>
              Edit
            </Link>
            {tenant.leases.length === 0 && (
              <ConfirmButton action={deleteTenant.bind(null, tenant.id)} message={`Delete ${tenant.fullName}?`}>
                Delete
              </ConfirmButton>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={`${cardClass} p-4`}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Balance owed</p>
            <p className={`text-2xl font-semibold ${owed > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
              {formatRent(Number(fromCents(owed)))}
            </p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Credit on account</p>
            <p className="text-2xl font-semibold">{formatRent(Number(fromCents(credit)))}</p>
          </div>
        </div>

        <Details
          items={[
            ["Phone", tenant.phone],
            ["Email", tenant.email ?? "—"],
            ["ID document", tenant.idDocType || tenant.idDocNumber ? `${tenant.idDocType ?? ""} ${tenant.idDocNumber ?? ""}`.trim() : "—"],
            ["Emergency contact", tenant.emergencyContact ?? "—"],
          ]}
        />
        {tenant.notes && <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{tenant.notes}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Leases</h2>
        {tenant.leases.length === 0 ? (
          <EmptyState>No leases yet.</EmptyState>
        ) : (
          <ul className={`${cardClass} divide-y divide-zinc-200 dark:divide-zinc-800`}>
            {tenant.leases.map(({ lease, isPrimary }) => (
              <li key={lease.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/landlord/leases/${lease.id}`} className="font-medium hover:underline">
                    {lease.room.name}, {lease.room.property.name}
                  </Link>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {formatDate(lease.startDate)} to {lease.endDate ? formatDate(lease.endDate) : "month-to-month"} ·{" "}
                    {formatRent(lease.rentAmount)} / month{isPrimary ? "" : " · co-tenant"}
                  </p>
                </div>
                <Badge className={LEASE_STATUS_STYLES[lease.status]}>{LEASE_STATUS_LABELS[lease.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Invoices</h2>
        <InvoiceTable invoices={invoices} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Payments</h2>
        <PaymentTable payments={payments} />
      </section>
    </div>
  );
}
