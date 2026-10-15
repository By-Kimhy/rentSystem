import type { Prisma, PropertyType, RoomStatus } from "@prisma/client";

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
