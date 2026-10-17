import type { InvoiceStatus, LateFeeType, LeaseStatus, PaymentMethod, Prisma, PropertyType, RoomStatus } from "@prisma/client";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  APARTMENT: "Apartment",
  CONDO: "Condo",
  HOUSE: "House",
};

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  MAINTENANCE: "Maintenance",
};

export const ROOM_STATUS_STYLES: Record<RoomStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  OCCUPIED: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
  MAINTENANCE: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

export function formatRent(amount: Prisma.Decimal | number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amount));
}

export function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ENDED: "Ended",
  TERMINATED: "Ended early",
};

export const LEASE_STATUS_STYLES: Record<LeaseStatus, string> = {
  DRAFT: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  ENDED: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
  TERMINATED: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
};

export const LATE_FEE_LABELS: Record<LateFeeType, string> = {
  NONE: "No late fee",
  FLAT: "Flat amount (USD)",
  PERCENT: "Percent of rent",
};

export type TenantStatus = "Active" | "Former" | "Prospect";

// Derived from the tenant's leases rather than stored, so it can never drift.
export function tenantStatus(leaseStatuses: LeaseStatus[]): TenantStatus {
  if (leaseStatuses.includes("ACTIVE")) return "Active";
  if (leaseStatuses.some((s) => s === "ENDED" || s === "TERMINATED")) return "Former";
  return "Prospect";
}

export const TENANT_STATUS_STYLES: Record<TenantStatus, string> = {
  Active: LEASE_STATUS_STYLES.ACTIVE,
  Former: LEASE_STATUS_STYLES.ENDED,
  Prospect: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

export function describeLateFee(type: LateFeeType, value: Prisma.Decimal | number) {
  if (type === "NONE") return "None";
  return type === "FLAT" ? formatRent(value) : `${Number(value)}% of rent`;
}

export function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  OPEN: "Open",
  PARTIAL: "Part paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
};

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PARTIAL: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  PAID: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  OVERDUE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  VOID: "bg-zinc-200 text-zinc-600 line-through dark:bg-zinc-700 dark:text-zinc-300",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK: "Bank transfer",
  CARD: "Card",
  WALLET: "Mobile wallet",
};

export function invoiceNumber(n: number) {
  return `INV-${String(n).padStart(5, "0")}`;
}

export function receiptNumber(n: string) {
  return `RCPT-${n.slice(-8).toUpperCase()}`;
}
