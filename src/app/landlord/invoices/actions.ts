"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/landlord/ActionForm";
import { applyCredit, refreshInvoice } from "@/lib/billing";
import { requireRole } from "@/lib/dal";
import { today } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { ownedLease } from "@/lib/leases";
import { chargeSchema, voidSchema } from "@/lib/validation";

async function ownedInvoice(invoiceId: string, landlordId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, lease: { room: { property: { landlordId } } } },
    include: { _count: { select: { allocations: true } } },
  });
  if (!invoice) throw new Error("Invoice not found");
  return invoice;
}

function revalidateRent() {
  revalidatePath("/landlord", "layout");
}

// A one-off charge (repair, utility) billed on its own invoice.
export async function addCharge(leaseId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const landlord = await requireRole("LANDLORD");
  const lease = await ownedLease(leaseId, landlord.id);
  if (lease.status === "DRAFT") return { error: "Activate the lease before billing it." };
  const parsed = chargeSchema.safeParse(Object.fromEntries(["kind", "description", "amount", "dueDate"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { kind, description, amount, dueDate } = parsed.data;
  const invoice = await prisma.invoice.create({
    data: {
      leaseId,
      kind: "OTHER",
      issueDate: today(),
      dueDate,
      total: amount,
      lines: { create: { kind, description, amount } },
    },
  });
  await refreshInvoice(invoice.id);
  await applyCredit(leaseId);
  revalidateRent();
  return {};
}

// Add a line to an invoice that isn't settled yet.
export async function addInvoiceLine(invoiceId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const landlord = await requireRole("LANDLORD");
  const invoice = await ownedInvoice(invoiceId, landlord.id);
  if (invoice.status === "VOID" || invoice.status === "PAID") return { error: "This invoice is closed. Bill a new charge instead." };
  const parsed = chargeSchema
    .omit({ dueDate: true })
    .safeParse(Object.fromEntries(["kind", "description", "amount"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  await prisma.invoiceLine.create({ data: { invoiceId, ...parsed.data } });
  await refreshInvoice(invoiceId);
  await applyCredit(invoice.leaseId);
  revalidateRent();
  return {};
}

export async function voidInvoice(invoiceId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const landlord = await requireRole("LANDLORD");
  const invoice = await ownedInvoice(invoiceId, landlord.id);
  if (invoice.status === "VOID") return { error: "This invoice is already void." };
  if (invoice._count.allocations > 0) {
    return { error: "Payments are applied to this invoice. Reverse them first, then void it." };
  }
  const parsed = voidSchema.safeParse({ reason: String(formData.get("reason") ?? "") });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "VOID", voidReason: parsed.data.reason } });
  revalidateRent();
  return {};
}
