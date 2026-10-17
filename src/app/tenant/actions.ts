"use server";

import { revalidatePath } from "next/cache";
import { api, attempt } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { fieldsFrom, type FormState } from "@/lib/validation";

// Both of these can lose a race with the landlord (it was decided while the page was open).
// attempt() turns that 409 into a result, and the refreshed page shows what happened instead.
export async function withdrawApplication(applicationId: string) {
  await requireRole("TENANT");
  await attempt(() => api.post(`/tenant/applications/${applicationId}/withdraw`));
  revalidatePath("/tenant");
}

export type ReportState = FormState & { sent?: number };

export async function reportPayment(_prev: ReportState, formData: FormData): Promise<ReportState> {
  await requireRole("TENANT");
  const values = fieldsFrom(formData, ["leaseId", "amount", "method", "paidOn", "reference", "note"]);
  const result = await attempt(() => api.post("/tenant/payment-reports", values));
  if (!result.ok) return { fieldErrors: result.fieldErrors ?? { form: [result.error] }, values };
  revalidatePath("/tenant");
  return { sent: Date.now() };
}

export async function cancelPaymentReport(reportId: string) {
  await requireRole("TENANT");
  await attempt(() => api.post(`/tenant/payment-reports/${reportId}/cancel`));
  revalidatePath("/tenant");
}
