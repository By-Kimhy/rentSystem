import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { TenantForm } from "@/components/landlord/TenantForm";
import { BackLink } from "@/components/landlord/ui";

export default async function EditTenantPage({ params }: PageProps<"/landlord/tenants/[id]/edit">) {
  const { id } = await params;
  const landlord = await requireRole("LANDLORD");
  const tenant = await prisma.tenant.findFirst({ where: { id, landlordId: landlord.id } });
  if (!tenant) notFound();
  return (
    <div className="max-w-2xl space-y-6">
      <BackLink href={`/landlord/tenants/${id}`}>{tenant.fullName}</BackLink>
      <h1 className="text-2xl font-semibold">Edit {tenant.fullName}</h1>
      <TenantForm
        tenant={{
          id: tenant.id,
          fullName: tenant.fullName,
          phone: tenant.phone,
          email: tenant.email ?? "",
          idDocType: tenant.idDocType ?? "",
          idDocNumber: tenant.idDocNumber ?? "",
          emergencyContact: tenant.emergencyContact ?? "",
          notes: tenant.notes ?? "",
        }}
      />
    </div>
  );
}
