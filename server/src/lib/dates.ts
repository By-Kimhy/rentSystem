// Calendar-date helpers. Every date is a UTC-midnight Date, matching Prisma's @db.Date columns.

const DAY_MS = 86_400_000;

// The billing day boundary. Set BILLING_TIMEZONE (e.g. "Asia/Phnom_Penh") so invoices
// turn overdue at local midnight rather than UTC midnight.
export function today(): Date {
  const timeZone = process.env.BILLING_TIMEZONE || "UTC";
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
  return parseDate(iso);
}

export function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function periodOf(date: Date): string {
  return toISODate(date).slice(0, 7);
}

export function nextPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function periodStart(period: string): Date {
  return parseDate(`${period}-01`);
}

export function periodEnd(period: string): Date {
  return addDays(periodStart(nextPeriod(period)), -1);
}

export function daysInPeriod(period: string): number {
  return daysBetween(periodStart(period), periodEnd(period)) + 1;
}

export function dateInPeriod(period: string, day: number): Date {
  return parseDate(`${period}-${String(day).padStart(2, "0")}`);
}

export function formatPeriod(period: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    periodStart(period),
  );
}

export const maxDate = (a: Date, b: Date) => (a > b ? a : b);
export const minDate = (a: Date, b: Date) => (a < b ? a : b);
