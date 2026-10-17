"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Tenant } from "@api/contract";
import { api, attempt } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { fieldsFrom, type FormState } from "@/lib/validation";

const TENANT_FIELDS = ["fullName", "phone", "email", "idDocType", "idDocNumber", "emergencyContact", "notes"];

export async function saveTenant(tenantId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("LANDLORD");
  const values = fieldsFrom(formData, TENANT_FIELDS);
  const result = await attempt(() =>
    tenantId
      ? api.put<{ tenant: Tenant }>(`/landlord/tenants/${tenantId}`, values)
      : api.post<{ tenant: Tenant }>("/landlord/tenants", values),
  );
  if (!result.ok) return { fieldErrors: result.fieldErrors ?? { fullName: [result.error] }, values };
  revalidatePath("/landlord/tenants");
  redirect(`/landlord/tenants/${result.data.tenant.id}`);
}

export async function deleteTenant(tenantId: string) {
  await requireRole("LANDLORD");
  await api.delete(`/landlord/tenants/${tenantId}`);
  revalidatePath("/landlord/tenants");
  redirect("/landlord/tenants");
}
