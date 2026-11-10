export interface PriceInput {
  priceMinor: number;
  compareAtMinor?: number | undefined;
  currency: string;
  platformCurrency: string;
}
export interface PriceError { path: 'priceMinor' | 'compareAtMinor' | 'currency'; message: string }

/** Price must be a positive integer (minor units); the only other rule is compare-at > price. No range limits are invented. */
export function validatePrice(i: PriceInput): PriceError[] {
  const errors: PriceError[] = [];
  if (!Number.isSafeInteger(i.priceMinor) || i.priceMinor <= 0) errors.push({ path: 'priceMinor', message: 'Price must be greater than zero.' });
  if (i.currency !== i.platformCurrency) errors.push({ path: 'currency', message: `Prices must be in ${i.platformCurrency}.` });
  if (i.compareAtMinor !== undefined) {
    if (!Number.isSafeInteger(i.compareAtMinor) || i.compareAtMinor <= i.priceMinor) {
      errors.push({ path: 'compareAtMinor', message: 'The original price must be higher than the price.' });
    }
  }
  return errors;
}
