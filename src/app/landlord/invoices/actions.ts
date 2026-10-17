"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/landlord/ActionForm";
import { api, attempt } from "@/lib/api";
import { requireRole } from "@/lib/dal";

const fields = (formData: FormData, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));

// Runs a rent change and reports the API's complaint, if any, back to the form.
async function change(fn: () => Promise<unknown>): Promise<ActionResult> {
  await requireRole("LANDLORD");
  const result = await attempt(fn);
  if (!result.ok) return result.fieldErrors ? { fieldErrors: result.fieldErrors } : { error: result.error };
  revalidatePath("/landlord", "layout");
  return {};
}

// A one-off charge (repair, utility) billed on its own invoice.
export async function addCharge(leaseId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return change(() =>
    api.post(`/landlord/leases/${leaseId}/charges`, fields(formData, ["kind", "description", "amount", "dueDate"])),
  );
}

// Add a line to an invoice that isn't settled yet.
export async function addInvoiceLine(invoiceId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return change(() => api.post(`/landlord/invoices/${invoiceId}/lines`, fields(formData, ["kind", "description", "amount"])));
}

export async function voidInvoice(invoiceId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return change(() => api.post(`/landlord/invoices/${invoiceId}/void`, fields(formData, ["reason"])));
}
