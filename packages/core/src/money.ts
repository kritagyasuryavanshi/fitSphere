/**
 * Money is always stored as a whole number of paise (1 rupee = 100 paise).
 * Never use floating-point rupees for prices, fees or payouts.
 */
export function formatInr(amountPaise: number): string {
  if (!Number.isInteger(amountPaise)) {
    throw new Error(`Amount must be a whole number of paise, got ${amountPaise}`);
  }
  const whole = amountPaise % 100 === 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amountPaise / 100);
}
