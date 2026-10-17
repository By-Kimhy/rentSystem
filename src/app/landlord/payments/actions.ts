"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/landlord/ActionForm";
import { applyCredit, depositSummary, refreshInvoice } from "@/lib/billing";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { formatRent } from "@/lib/format";
import { ownedLease } from "@/lib/leases";
import { fromCents, toCents } from "@/lib/money";
import { depositTransactionSchema, paymentSchema, type FormState } from "@/lib/validation";

const PAYMENT_FIELDS = ["leaseId", "payerTenantId", "amount", "method", "paidOn", "reference", "notes"];

function revalidateRent() {
  revalidatePath("/landlord", "layout");
}

export async function recordPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const landlord = await requireRole("LANDLORD");
  const values = Object.fromEntries(
    [...formData.entries()].filter(([k]) => typeof k === "string" && !k.startsWith("$")).map(([k, v]) => [k, String(v)]),
  );
  const parsed = paymentSchema.safeParse(Object.fromEntries(PAYMENT_FIELDS.map((k) => [k, values[k] ?? ""])));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const { leaseId, payerTenantId, ...payment } = parsed.data;
  const lease = await ownedLease(leaseId, landlord.id);
  if (lease.status === "DRAFT") return { fieldErrors: { leaseId: ["Activate the lease first."] }, values };
  if (payerTenantId) {
    const onLease = await prisma.leaseTenant.count({ where: { leaseId, tenantId: payerTenantId } });
    if (!onLease) return { fieldErrors: { payerTenantId: ["Choose a tenant on this lease."] }, values };
  }

  // Optional manual split: alloc_<invoiceId> fields. Blank everywhere = oldest invoice first.
  const unpaid = await prisma.invoice.findMany({
    where: { leaseId, status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } },
  });
  const split: { invoiceId: string; cents: number }[] = [];
  for (const invoice of unpaid) {
    const raw = (values[`alloc_${invoice.id}`] ?? "").trim();
    if (raw === "") continue;
    const cents = toCents(Number(raw));
    if (!Number.isFinite(Number(raw)) || cents < 0) {
      return { fieldErrors: { allocations: ["Split amounts must be positive numbers."] }, values };
    }
    if (cents > toCents(invoice.total) - toCents(invoice.amountPaid)) {
      return { fieldErrors: { allocations: ["A split amount is more than that invoice's balance."] }, values };
    }
    if (cents > 0) split.push({ invoiceId: invoice.id, cents });
  }
  const amountCents = toCents(payment.amount);
  if (split.reduce((s, a) => s + a.cents, 0) > amountCents) {
    return { fieldErrors: { allocations: ["The split adds up to more than the payment."] }, values };
  }

  const saved = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        ...payment,
        leaseId,
        payerTenantId,
        amount: fromCents(amountCents),
        receivedById: landlord.id,
        allocations: { create: split.map((a) => ({ invoiceId: a.invoiceId, amount: fromCents(a.cents) })) },
      },
    });
    for (const a of split) await refreshInvoice(a.invoiceId, tx);
    return created;
  });
  // Whatever wasn't split by hand goes to the oldest unpaid invoices; any rest stays as credit.
  await applyCredit(leaseId);
  revalidateRent();
  redirect(`/landlord/payments/${saved.id}`);
}

// Undo a payment by recording its mirror image, so the history still adds up.
export async function reversePayment(paymentId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const landlord = await requireRole("LANDLORD");
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, lease: { room: { property: { landlordId: landlord.id } } } },
    include: { allocations: true, reversedBy: { select: { id: true } } },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.reversalOfId) return { error: "A reversal can't itself be reversed." };
  if (payment.reversedBy) return { error: "This payment has already been reversed." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason for the reversal." };

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        leaseId: payment.leaseId,
        payerTenantId: payment.payerTenantId,
        amount: payment.amount.negated(),
        method: payment.method,
        paidOn: payment.paidOn,
        reference: payment.reference,
        notes: `Reversal: ${reason}`,
        receivedById: landlord.id,
        reversalOfId: payment.id,
        allocations: {
          create: payment.allocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount.negated() })),
        },
      },
    });
    for (const a of payment.allocations) await refreshInvoice(a.invoiceId, tx);
  });
  revalidateRent();
  return {};
}

export async function addDepositTransaction(leaseId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const landlord = await requireRole("LANDLORD");
  const lease = await ownedLease(leaseId, landlord.id);
  if (lease.status !== "ENDED" && lease.status !== "TERMINATED") {
    return { error: "Settle the deposit after the lease has ended." };
  }
  const parsed = depositTransactionSchema.safeParse(
    Object.fromEntries(["kind", "amount", "date", "reason"].map((k) => [k, String(formData.get(k) ?? "")])),
  );
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { kind, amount, date, reason } = parsed.data;
  if (kind === "DEDUCTION" && !reason) return { fieldErrors: { reason: ["Say what the deduction is for."] } };
  const { heldCents } = await depositSummary(leaseId);
  if (toCents(amount) > heldCents) {
    return { error: `That's more than the ${formatRent(Number(fromCents(heldCents)))} deposit still held.` };
  }
  await prisma.depositTransaction.create({ data: { leaseId, kind, amount, date, reason } });
  revalidateRent();
  return {};
}
