"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { fieldsFrom, tenantSchema, type FormState } from "@/lib/validation";

const TENANT_FIELDS = ["fullName", "phone", "email", "idDocType", "idDocNumber", "emergencyContact", "notes"];

export async function saveTenant(tenantId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const landlord = await requireRole("LANDLORD");
  const values = fieldsFrom(formData, TENANT_FIELDS);
  const parsed = tenantSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  let id = tenantId;
  if (tenantId) {
    const updated = await prisma.tenant.updateMany({ where: { id: tenantId, landlordId: landlord.id }, data: parsed.data });
    if (updated.count === 0) throw new Error("Tenant not found");
  } else {
    id = (await prisma.tenant.create({ data: { ...parsed.data, landlordId: landlord.id } })).id;
  }
  revalidatePath("/landlord/tenants");
  redirect(`/landlord/tenants/${id}`);
}

export async function deleteTenant(tenantId: string) {
  const landlord = await requireRole("LANDLORD");
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, landlordId: landlord.id },
    include: { _count: { select: { leases: true } } },
  });
  if (!tenant) throw new Error("Tenant not found");
  // Tenants with lease history are kept so invoices and payments stay readable.
  if (tenant._count.leases > 0) throw new Error("A tenant who has been on a lease can't be deleted");
  await prisma.tenant.delete({ where: { id: tenantId } });
  revalidatePath("/landlord/tenants");
  redirect("/landlord/tenants");
}
