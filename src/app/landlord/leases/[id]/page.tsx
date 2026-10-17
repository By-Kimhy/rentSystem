import Link from "next/link";
import { notFound } from "next/navigation";
import { activateLease, deleteLease, endLease, renewLease } from "../actions";
import { addCharge } from "../../invoices/actions";
import { addDepositTransaction } from "../../payments/actions";
import { depositSummary, leaseCreditCents, syncBilling } from "@/lib/billing";
import { requireRole } from "@/lib/dal";
import { today, toISODate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import {
  LEASE_STATUS_LABELS,
  LEASE_STATUS_STYLES,
  describeLateFee,
  formatDate,
  formatRent,
  ordinal,
} from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";
import { ActionButton, ActionForm } from "@/components/landlord/ActionForm";
import { ConfirmButton } from "@/components/landlord/ConfirmButton";
import { InvoiceTable } from "@/components/landlord/InvoiceTable";
import { PaymentTable } from "@/components/landlord/PaymentTable";
import { inputClass } from "@/components/landlord/fields";
import {
  Badge,
  BackLink,
  Details,
  cardClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/landlord/ui";

const usd = (cents: number) => formatRent(Number(fromCents(cents)));

export default async function LeasePage({ params, searchParams }: PageProps<"/landlord/leases/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  const landlord = await requireRole("LANDLORD");
  await syncBilling(landlord.id);
  const lease = await prisma.lease.findFirst({
    where: { id, room: { property: { landlordId: landlord.id } } },
    include: {
      room: { include: { property: true } },
      tenants: { include: { tenant: true }, orderBy: { isPrimary: "desc" } },
      invoices: { orderBy: [{ dueDate: "desc" }, { number: "desc" }] },
      payments: { orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }], include: { payer: { select: { fullName: true } } } },
      renewedFrom: { select: { id: true } },
      renewedBy: { select: { id: true, status: true } },
    },
  });
  if (!lease) notFound();

  const [credit, deposit] = await Promise.all([leaseCreditCents(lease.id), depositSummary(lease.id)]);
  const owed = lease.invoices
    .filter((i) => ["OPEN", "PARTIAL", "OVERDUE"].includes(i.status))
    .reduce((s, i) => s + toCents(i.total) - toCents(i.amountPaid), 0);
  const ended = lease.status === "ENDED" || lease.status === "TERMINATED";
  const lastDay = lease.terminatedOn ?? lease.endDate;
  const todayIso = toISODate(today());

  return (
    <div className="space-y-8">
      <BackLink href="/landlord/leases">Leases</BackLink>

      {typeof error === "string" && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">
                {lease.room.name}, {lease.room.property.name}
              </h1>
              <Badge className={LEASE_STATUS_STYLES[lease.status]}>{LEASE_STATUS_LABELS[lease.status]}</Badge>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">
              {lease.room.property.address}, {lease.room.property.city}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {lease.status === "DRAFT" && (
              <>
                <ActionForm action={activateLease.bind(null, lease.id)} className="flex flex-col items-end gap-1">
                  <ActionButton className={primaryButtonClass}>Activate lease</ActionButton>
                </ActionForm>
                <Link href={`/landlord/leases/${lease.id}/edit`} className={linkClass}>
                  Edit
                </Link>
                <ConfirmButton action={deleteLease.bind(null, lease.id)} message="Delete this draft lease?">
                  Delete
                </ConfirmButton>
              </>
            )}
            {lease.status !== "DRAFT" && (
              <Link href={`/landlord/payments/new?lease=${lease.id}`} className={primaryButtonClass}>
                Record payment
              </Link>
            )}
            {lastDay && lease.status !== "DRAFT" && !lease.renewedBy && (
              <form action={renewLease.bind(null, lease.id)}>
                <button type="submit" className={secondaryButtonClass}>
                  Renew
                </button>
              </form>
            )}
            {lease.renewedBy && (
              <Link href={`/landlord/leases/${lease.renewedBy.id}`} className={linkClass}>
                View renewal
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className={`${cardClass} p-4`}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Balance owed</p>
            <p className={`text-2xl font-semibold ${owed > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{usd(owed)}</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Credit</p>
            <p className="text-2xl font-semibold">{usd(credit)}</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Deposit held</p>
            <p className="text-2xl font-semibold">{usd(deposit.heldCents)}</p>
          </div>
        </div>

        <Details
          items={[
            ["Starts", formatDate(lease.startDate)],
            ["Ends", lease.endDate ? formatDate(lease.endDate) : "Month-to-month"],
            ...(lease.terminatedOn ? ([["Ended early on", formatDate(lease.terminatedOn)]] as [string, string][]) : []),
            ["Monthly rent", `${formatRent(lease.rentAmount)}, due on the ${ordinal(lease.dueDay)}`],
            ["Security deposit", formatRent(lease.depositAmount)],
            ["Overdue after", `${lease.graceDays} grace ${lease.graceDays === 1 ? "day" : "days"}`],
            ["Late fee", describeLateFee(lease.lateFeeType, lease.lateFeeValue)],
          ]}
        />
        {lease.renewedFrom && (
          <p className="text-sm">
            Renews an{" "}
            <Link href={`/landlord/leases/${lease.renewedFrom.id}`} className={linkClass}>
              earlier lease
            </Link>
            .
          </p>
        )}
        {lease.notes && <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{lease.notes}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Tenants</h2>
        <ul className={`${cardClass} divide-y divide-zinc-200 dark:divide-zinc-800`}>
          {lease.tenants.map(({ tenant, isPrimary }) => (
            <li key={tenant.id} className="flex items-center justify-between p-4">
              <Link href={`/landlord/tenants/${tenant.id}`} className="font-medium hover:underline">
                {tenant.fullName}
              </Link>
              <span className="text-sm text-zinc-500">
                {tenant.phone}
                {isPrimary ? " · primary" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Invoices</h2>
        {lease.status === "DRAFT" ? (
          <p className="text-zinc-500">Invoices start once the lease is activated.</p>
        ) : (
          <InvoiceTable invoices={lease.invoices} />
        )}
        {lease.status !== "DRAFT" && (
          <details className={`${cardClass} p-4`}>
            <summary className="cursor-pointer text-sm font-medium">Bill a one-off charge</summary>
            <ActionForm action={addCharge.bind(null, lease.id)} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Type
                <select name="kind" defaultValue="UTILITY" className={inputClass}>
                  <option value="UTILITY">Utility</option>
                  <option value="OTHER">Other (repair, cleaning…)</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Description
                <input name="description" required className={inputClass} placeholder="Electricity, September" />
              </label>
              <label className="text-sm font-medium">
                Amount (USD)
                <input name="amount" type="number" step="0.01" min="0.01" required className={inputClass} />
              </label>
              <label className="text-sm font-medium">
                Due date
                <input name="dueDate" type="date" defaultValue={todayIso} required className={inputClass} />
              </label>
              <div>
                <ActionButton className={secondaryButtonClass}>Add charge</ActionButton>
              </div>
            </ActionForm>
          </details>
        )}
      </section>

      {lease.status !== "DRAFT" && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Payments</h2>
          <PaymentTable payments={lease.payments} />
        </section>
      )}

      {lease.status === "ACTIVE" && (
        <section className={`${cardClass} space-y-3 p-4`}>
          <h2 className="text-lg font-semibold">End this lease</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Stops new rent invoices after the last day, prorates the final month and frees the room. Unpaid invoices
            after that month are voided.
          </p>
          <ActionForm
            action={endLease.bind(null, lease.id)}
            confirmMessage="End this lease on the chosen day?"
            className="flex flex-wrap items-end gap-3"
          >
            <label className="text-sm font-medium">
              Last day in the room
              <input
                name="endOn"
                type="date"
                defaultValue={lease.endDate ? formatDate(lease.endDate) : todayIso}
                required
                className={inputClass}
              />
            </label>
            <ActionButton className={secondaryButtonClass}>End lease</ActionButton>
          </ActionForm>
        </section>
      )}

      {ended && (
        <section className={`${cardClass} space-y-4 p-4`}>
          <h2 className="text-lg font-semibold">Move-out and deposit</h2>
          <Details
            items={[
              ["Deposit received", usd(deposit.receivedCents)],
              ["Deducted", usd(deposit.deductedCents)],
              ["Refunded", usd(deposit.refundedCents)],
              ["Still held", usd(deposit.heldCents)],
            ]}
          />
          {deposit.transactions.length > 0 && (
            <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              {deposit.transactions.map((t) => (
                <li key={t.id} className="flex justify-between py-2">
                  <span>
                    {formatDate(t.date)} · {t.kind === "DEDUCTION" ? "Deduction" : "Refund"}
                    {t.reason ? `: ${t.reason}` : ""}
                  </span>
                  <span>{formatRent(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {deposit.heldCents > 0 ? (
            <ActionForm action={addDepositTransaction.bind(null, lease.id)} className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Type
                <select name="kind" defaultValue="DEDUCTION" className={inputClass}>
                  <option value="DEDUCTION">Deduction (keep part of the deposit)</option>
                  <option value="REFUND">Refund to tenant</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Amount (USD)
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={fromCents(deposit.heldCents)}
                  required
                  className={inputClass}
                />
              </label>
              <label className="text-sm font-medium">
                Reason
                <input name="reason" className={inputClass} placeholder="Broken window, unpaid rent…" />
              </label>
              <label className="text-sm font-medium">
                Date
                <input name="date" type="date" defaultValue={todayIso} required className={inputClass} />
              </label>
              <div>
                <ActionButton className={secondaryButtonClass}>Record</ActionButton>
              </div>
            </ActionForm>
          ) : (
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {deposit.receivedCents > 0 ? "Deposit fully settled." : "No deposit was paid on this lease."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
