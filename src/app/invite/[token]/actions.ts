"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/landlord/ActionForm";
import { ApiError, api } from "@/lib/api";
import { requireRole } from "@/lib/dal";

export async function acceptInvite(token: string): Promise<ActionResult> {
  await requireRole("TENANT");
  try {
    await api.post(`/tenant/invites/${encodeURIComponent(token)}/accept`);
  } catch (e) {
    // 404: expired or used; 409: already linked to another record with this landlord.
    if (e instanceof ApiError && (e.status === 404 || e.status === 409)) return { error: e.message };
    throw e;
  }
  revalidatePath("/tenant");
  redirect("/tenant");
}
