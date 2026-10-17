import Link from "next/link";
import type { PaymentReportItem, PaymentRow } from "@api/contract";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { PaymentReports } from "@/components/landlord/PaymentReports";
import { PaymentTable } from "@/components/landlord/PaymentTable";
import { PageHeader, primaryButtonClass } from "@/components/landlord/ui";

export const metadata = { title: "Payments · RentSystem" };

export default async function PaymentsPage() {
  await requireRole("LANDLORD");
  const [{ payments }, { reports }] = await Promise.all([
    apiGet<{ payments: PaymentRow[] }>("/landlord/payments"),
    apiGet<{ reports: PaymentReportItem[] }>("/landlord/payment-reports"),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Payments">
        <Link href="/landlord/payments/new" className={primaryButtonClass}>
          Record payment
        </Link>
      </PageHeader>
      <PaymentReports reports={reports} />
      <PaymentTable
        showRoom
        payments={payments.map((p) => ({ ...p, roomLabel: `${p.lease.room.name}, ${p.lease.room.property.name}` }))}
      />
    </div>
  );
}
