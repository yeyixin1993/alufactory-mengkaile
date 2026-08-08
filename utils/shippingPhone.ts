const SHIPPING_PHONE_PATTERN = /^1\d{10}(?:-\d{4})?$/;

/**
 * Shipping contacts may include an optional four-digit privacy extension.
 * Store one canonical form so PDFs, order JSON and duplicate detection agree.
 */
export const normalizeShippingPhone = (value: string): string => (
  String(value || '')
    .trim()
    .replace(/[‐‑‒–—―－]/g, '-')
    .replace(/\s+/g, '')
);

export const isValidShippingPhone = (value: string): boolean => (
  SHIPPING_PHONE_PATTERN.test(normalizeShippingPhone(value))
);

