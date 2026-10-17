"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Payment } from "@api/contract";
import type { ActionResult } from "@/components/landlord/ActionForm";
import { api, attempt } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import type { FormState } from "@/lib/validation";

const PAYMENT_FIELDS = ["leaseId", "payerTenantId", "amount", "method", "paidOn", "reference", "notes"];

function revalidateRent() {
  revalidatePath("/landlord", "layout");
}

export async function recordPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("LANDLORD");
  const values = Object.fromEntries(
    [...formData.entries()].filter(([k]) => typeof k === "string" && !k.startsWith("$")).map(([k, v]) => [k, String(v)]),
  );
  // Optional manual split: alloc_<invoiceId> fields become { invoiceId: amount }.
  const allocations = Object.fromEntries(
    Object.entries(values)
      .filter(([k, v]) => k.startsWith("alloc_") && v.trim() !== "")
      .map(([k, v]) => [k.slice("alloc_".length), v]),
  );
  const body = { ...Object.fromEntries(PAYMENT_FIELDS.map((k) => [k, values[k] ?? ""])), allocations };
  const result = await attempt(() => api.post<{ payment: Payment }>("/landlord/payments", body));
  if (!result.ok) return { fieldErrors: result.fieldErrors ?? { leaseId: [result.error] }, values };
  revalidateRent();
  redirect(`/landlord/payments/${result.data.payment.id}`);
}

// Undo a payment by recording its mirror image, so the history still adds up.
export async function reversePayment(paymentId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("LANDLORD");
  const result = await attempt(() =>
    api.post(`/landlord/payments/${paymentId}/reverse`, { reason: String(formData.get("reason") ?? "") }),
  );
  if (!result.ok) return { error: result.fieldErrors?.reason?.[0] ?? result.error };
  revalidateRent();
  return {};
}

export async function addDepositTransaction(leaseId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("LANDLORD");
  const body = Object.fromEntries(["kind", "amount", "date", "reason"].map((k) => [k, String(formData.get(k) ?? "")]));
  const result = await attempt(() => api.post(`/landlord/leases/${leaseId}/deposit-transactions`, body));
  if (!result.ok) return result.fieldErrors ? { fieldErrors: result.fieldErrors } : { error: result.error };
  revalidateRent();
  return {};
}

// A tenant's reported payment: confirming records it as a payment; rejecting needs a reason.
export async function confirmPaymentReport(reportId: string): Promise<ActionResult> {
  await requireRole("LANDLORD");
  const result = await attempt(() => api.post(`/landlord/payment-reports/${reportId}/confirm`));
  if (!result.ok) return { error: result.error };
  revalidateRent();
  return {};
}

export async function rejectPaymentReport(reportId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("LANDLORD");
  const result = await attempt(() =>
    api.post(`/landlord/payment-reports/${reportId}/reject`, { reason: String(formData.get("reason") ?? "") }),
  );
  if (!result.ok) return { error: result.fieldErrors?.reason?.[0] ?? result.error };
  revalidateRent();
  return {};
}
