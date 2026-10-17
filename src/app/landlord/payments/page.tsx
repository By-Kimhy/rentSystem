import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { PaymentTable } from "@/components/landlord/PaymentTable";
import { PageHeader, primaryButtonClass } from "@/components/landlord/ui";

export const metadata = { title: "Payments · RentSystem" };

export default async function PaymentsPage() {
  const landlord = await requireRole("LANDLORD");
  const payments = await prisma.payment.findMany({
    where: { lease: { room: { property: { landlordId: landlord.id } } } },
    orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
    take: 500,
    include: {
      payer: { select: { fullName: true } },
      lease: { select: { room: { select: { name: true, property: { select: { name: true } } } } } },
    },
  });
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
