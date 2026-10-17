"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/dal";

export async function withdrawApplication(applicationId: string) {
  await requireRole("TENANT");
  await api.post(`/tenant/applications/${applicationId}/withdraw`);
  revalidatePath("/tenant");
}
