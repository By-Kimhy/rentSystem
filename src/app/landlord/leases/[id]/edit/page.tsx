import { redirect } from "next/navigation";
import type { LeaseResponse } from "@api/contract";
import { leaseFormOptions } from "../../form-data";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { LeaseForm } from "@/components/landlord/LeaseForm";
import { BackLink } from "@/components/landlord/ui";

export default async function EditLeasePage({ params }: PageProps<"/landlord/leases/[id]/edit">) {
  const { id } = await params;
  await requireRole("LANDLORD");
  const { lease } = await apiGet<LeaseResponse>(`/landlord/leases/${id}`);
  // Signed terms don't change; a new term is a renewal.
  if (lease.status !== "DRAFT") redirect(`/landlord/leases/${id}`);
  const { properties, tenants } = await leaseFormOptions();

  return (
    <div className="max-w-2xl space-y-6">
      <BackLink href={`/landlord/leases/${id}`}>Lease</BackLink>
      <h1 className="text-2xl font-semibold">Edit draft lease</h1>
      <LeaseForm
        leaseId={id}
        properties={properties}
        tenants={tenants}
        initial={{
          roomId: lease.roomId,
          primaryTenantId: lease.tenants.find((t) => t.isPrimary)?.tenantId ?? "",
          otherTenantIds: lease.tenants.filter((t) => !t.isPrimary).map((t) => t.tenantId).join(","),
          startDate: formatDate(lease.startDate),
          endDate: lease.endDate ? formatDate(lease.endDate) : "",
          rentAmount: lease.rentAmount,
          dueDay: String(lease.dueDay),
          depositAmount: lease.depositAmount,
          graceDays: String(lease.graceDays),
          lateFeeType: lease.lateFeeType,
          lateFeeValue: lease.lateFeeValue,
          notes: lease.notes ?? "",
        }}
      />
    </div>
  );
}
