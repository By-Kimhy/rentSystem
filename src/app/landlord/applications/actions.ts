"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Application } from "@api/contract";
import { api, attempt } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { toISODate } from "@/lib/dates";
import type { ActionResult } from "@/components/landlord/ActionForm";

// Approving creates (or reuses) the applicant's tenant record; the landlord then writes the
// lease on a form already filled in with the room, tenant and move-in date.
export async function approveApplication(applicationId: string): Promise<ActionResult> {
  await requireRole("LANDLORD");
  const result = await attempt(() => api.post<{ application: Application }>(`/landlord/applications/${applicationId}/approve`));
  if (!result.ok) return { error: result.error };
  const { room, tenant, moveInDate } = result.data.application;
  revalidatePath("/landlord/applications");
  revalidatePath("/landlord/tenants");
  const query = new URLSearchParams({ room: room.id, tenant: tenant!.id, start: toISODate(moveInDate) });
  redirect(`/landlord/leases/new?${query}`);
}

export async function rejectApplication(applicationId: string): Promise<ActionResult> {
  await requireRole("LANDLORD");
  const result = await attempt(() => api.post(`/landlord/applications/${applicationId}/reject`));
  if (!result.ok) return { error: result.error };
  revalidatePath("/landlord/applications");
  redirect("/landlord/applications");
}
