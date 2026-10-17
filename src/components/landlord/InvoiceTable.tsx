import Link from "next/link";
import type { InvoiceStatus } from "@api/contract";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_STYLES, formatDate, formatRent, invoiceNumber } from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";
import { daysOverdue, formatPeriod } from "@/lib/dates";
import { Badge, EmptyState, cardClass, tableClass, tdClass, thClass } from "./ui";

export type InvoiceRow = {
  id: string;
  number: number;
  kind: "RENT" | "DEPOSIT" | "OTHER";
  period: string | null;
  dueDate: Date;
  total: string;
  amountPaid: string;
  status: InvoiceStatus;
  tenantName?: string;
  roomLabel?: string;
};

export function invoiceLabel(i: Pick<InvoiceRow, "kind" | "period">) {
  if (i.kind === "RENT" && i.period) return `Rent, ${formatPeriod(i.period)}`;
  return i.kind === "DEPOSIT" ? "Security deposit" : "Other charges";
}

export function InvoiceTable({ invoices, showTenant = false }: { invoices: InvoiceRow[]; showTenant?: boolean }) {
  if (invoices.length === 0) return <EmptyState>No invoices yet.</EmptyState>;
  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <table className={tableClass}>
        <thead className="border-b border-zinc-200 dark:border-zinc-800">
          <tr>
            <th className={thClass}>Invoice</th>
            {showTenant && <th className={thClass}>Tenant</th>}
            <th className={thClass}>Due</th>
            <th className={`${thClass} text-right`}>Total</th>
            <th className={`${thClass} text-right`}>Balance</th>
            <th className={thClass}>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {invoices.map((i) => {
            const balance = i.status === "VOID" ? 0 : toCents(i.total) - toCents(i.amountPaid);
            return (
              <tr key={i.id}>
                <td className={tdClass}>
                  <Link href={`/landlord/invoices/${i.id}`} className="font-medium hover:underline">
                    {invoiceNumber(i.number)}
                  </Link>
                  <div className="text-zinc-500">{invoiceLabel(i)}</div>
                </td>
                {showTenant && (
                  <td className={tdClass}>
                    {i.tenantName}
                    {i.roomLabel && <div className="text-zinc-500">{i.roomLabel}</div>}
                  </td>
                )}
                <td className={tdClass}>
                  {formatDate(i.dueDate)}
                  {i.status === "OVERDUE" && (
                    <div className="text-red-600 dark:text-red-400">{daysOverdue(i.dueDate)} days late</div>
                  )}
                </td>
                <td className={`${tdClass} text-right`}>{formatRent(i.total)}</td>
                <td className={`${tdClass} text-right`}>{formatRent(Number(fromCents(balance)))}</td>
                <td className={tdClass}>
                  <Badge className={INVOICE_STATUS_STYLES[i.status]}>{INVOICE_STATUS_LABELS[i.status]}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
