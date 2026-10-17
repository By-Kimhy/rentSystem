import Link from "next/link";
import type { PaymentRow } from "@api/contract";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { PaymentTable } from "@/components/landlord/PaymentTable";
import { PageHeader, primaryButtonClass } from "@/components/landlord/ui";

export const metadata = { title: "Payments · RentSystem" };

export default async function PaymentsPage() {
  await requireRole("LANDLORD");
  const { payments } = await apiGet<{ payments: PaymentRow[] }>("/landlord/payments");
  return (
    <div className="space-y-6">
      <PageHeader title="Payments">
        <Link href="/landlord/payments/new" className={primaryButtonClass}>
          Record payment
        </Link>
      </PageHeader>
      <PaymentTable
        showRoom
        payments={payments.map((p) => ({ ...p, roomLabel: `${p.lease.room.name}, ${p.lease.room.property.name}` }))}
      />
    </div>
  );
}
