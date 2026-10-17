"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/landlord/ActionForm";
import { api, attempt } from "@/lib/api";
import { requireRole } from "@/lib/dal";

export async function setUserDisabled(userId: string, disabled: boolean): Promise<ActionResult> {
  await requireRole("ADMIN");
  const result = await attempt(() => api.post(`/admin/users/${userId}/${disabled ? "disable" : "enable"}`));
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin");
  return {};
}
