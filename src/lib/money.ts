// Money is stored as Decimal(10,2) and calculated in whole cents so rounding never drifts.
export function toCents(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
