"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Lease, LeaseSaveResponse } from "@api/contract";
import type { ActionResult } from "@/components/landlord/ActionForm";
import { api, attempt } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { fieldsFrom, type FormState } from "@/lib/validation";

const LEASE_FIELDS = [
  "roomId",
  "primaryTenantId",
  "startDate",
  "endDate",
  "rentAmount",
  "dueDay",
  "depositAmount",
  "graceDays",
  "lateFeeType",
  "lateFeeValue",
  "notes",
];

function revalidateRent() {
  revalidatePath("/landlord", "layout");
}

const failed = (r: { error: string; fieldErrors?: ActionResult["fieldErrors"] }): ActionResult =>
  r.fieldErrors ? { fieldErrors: r.fieldErrors } : { error: r.error };

export async function saveLease(leaseId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("LANDLORD");
  const values = fieldsFrom(formData, LEASE_FIELDS);
  const otherTenantIds = formData.getAll("otherTenantIds").map(String);
  const echo = { ...values, otherTenantIds: otherTenantIds.join(",") };
  const body = { ...values, otherTenantIds, intent: String(formData.get("intent") ?? "draft") };
  const result = await attempt(() =>
    leaseId
      ? api.put<LeaseSaveResponse>(`/landlord/leases/${leaseId}`, body)
      : api.post<LeaseSaveResponse>("/landlord/leases", body),
  );
  if (!result.ok) return { fieldErrors: result.fieldErrors ?? { roomId: [result.error] }, values: echo };

  const { lease, activationError } = result.data;
  revalidateRent();
  if (activationError) redirect(`/landlord/leases/${lease.id}?error=${encodeURIComponent(activationError)}`);
  redirect(`/landlord/leases/${lease.id}`);
}

export async function activateLease(leaseId: string): Promise<ActionResult> {
  await requireRole("LANDLORD");
  const result = await attempt(() => api.post(`/landlord/leases/${leaseId}/activate`));
  if (!result.ok) return failed(result);
  revalidateRent();
  return {};
}

export async function endLease(leaseId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("LANDLORD");
  const result = await attempt(() =>
    api.post(`/landlord/leases/${leaseId}/end`, { endOn: String(formData.get("endOn") ?? "") }),
  );
  if (!result.ok) return failed(result);
  revalidateRent();
  return {};
}

// Renewal starts a new draft with the same terms; renewing twice opens the existing renewal.
export async function renewLease(leaseId: string) {
  await requireRole("LANDLORD");
  const { lease } = await api.post<{ lease: Lease }>(`/landlord/leases/${leaseId}/renew`);
  revalidateRent();
  redirect(lease.status === "DRAFT" ? `/landlord/leases/${lease.id}/edit` : `/landlord/leases/${lease.id}`);
}

export async function deleteLease(leaseId: string) {
  await requireRole("LANDLORD");
  await api.delete(`/landlord/leases/${leaseId}`);
  revalidateRent();
  redirect("/landlord/leases");
}
