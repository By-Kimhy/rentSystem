import Link from "next/link";
import type { PaymentMethod, Prisma } from "@prisma/client";
import { PAYMENT_METHOD_LABELS, formatDate, formatRent, receiptNumber } from "@/lib/format";
import { EmptyState, cardClass, tableClass, tdClass, thClass } from "./ui";

export type PaymentRow = {
  id: string;
  amount: Prisma.Decimal;
  method: PaymentMethod;
  paidOn: Date;
  reference: string | null;
  reversalOfId: string | null;
  payer: { fullName: string } | null;
  roomLabel?: string;
};

export function PaymentTable({ payments, showRoom = false }: { payments: PaymentRow[]; showRoom?: boolean }) {
  if (payments.length === 0) return <EmptyState>No payments recorded yet.</EmptyState>;
  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <table className={tableClass}>
        <thead className="border-b border-zinc-200 dark:border-zinc-800">
          <tr>
            <th className={thClass}>Date</th>
            <th className={thClass}>Receipt</th>
            <th className={thClass}>Paid by</th>
            <th className={thClass}>Method</th>
            <th className={`${thClass} text-right`}>Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {payments.map((p) => (
            <tr key={p.id} className={p.reversalOfId ? "text-zinc-500" : undefined}>
              <td className={tdClass}>{formatDate(p.paidOn)}</td>
              <td className={tdClass}>
                <Link href={`/landlord/payments/${p.id}`} className="font-medium hover:underline">
                  {receiptNumber(p.id)}
                </Link>
                {p.reversalOfId && <div>Reversal</div>}
              </td>
              <td className={tdClass}>
                {p.payer?.fullName ?? "—"}
                {showRoom && p.roomLabel && <div className="text-zinc-500">{p.roomLabel}</div>}
              </td>
              <td className={tdClass}>
                {PAYMENT_METHOD_LABELS[p.method]}
                {p.reference && <div className="text-zinc-500">{p.reference}</div>}
              </td>
              <td className={`${tdClass} text-right`}>{formatRent(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
