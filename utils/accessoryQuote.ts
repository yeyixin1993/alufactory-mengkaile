import type { Language } from '../types';
import {
  ACCESSORY_COLOR_MODES,
  ACCESSORY_ROWS,
  getAccessoryRowSeriesLabel,
  type AccessoryColorMode,
  type AccessoryRow,
} from '../data/accessoryCatalog';
import { ACCESSORY_BULK_THRESHOLD } from './accessoryPricing';

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface AccessoryQuoteLine {
  row: AccessoryRow;
  key: string;
  quantity: number;
  isBulk: boolean;
  unitPrice: number;
  subtotal: number;
}

export interface AccessoryQuoteSummary {
  lines: AccessoryQuoteLine[];
  totalQuantity: number;
  total: number;
  /** `2020 / 3030`, or `-` when nothing is selected. */
  seriesLabel: string;
}

/** Colour choices exposed to the customer: 本色 and 彩色 only. */
export const isAccessoryColorMode = (value: unknown): value is AccessoryColorMode => (
  ACCESSORY_COLOR_MODES.includes(value as AccessoryColorMode)
);

/** Natural (本色) is always the default; anything else resolves to 本色. */
export const normalizeAccessoryColorMode = (value: unknown): AccessoryColorMode => (
  isAccessoryColorMode(value) ? value : 'natural'
);

/**
 * Unit price for one accessory row. 本色 uses the natural tier, 彩色 uses the
 * coloured tier, and quantities at or above the bulk threshold use bulk rates.
 * Length-priced parts (8mm shafts) are billed per metre.
 */
export const resolveAccessoryUnitPrice = (
  row: AccessoryRow,
  colorMode: AccessoryColorMode,
  quantity: number,
  shaftLengthMm = 0,
): number => {
  const isBulk = !row.naturalOnly && quantity >= ACCESSORY_BULK_THRESHOLD;
  const catalogPrice = row.naturalOnly || colorMode === 'natural'
    ? (isBulk ? row.price.naturalBulk : row.price.natural)
    : (isBulk ? row.price.coloredBulk : row.price.colored);
  return row.lengthPriced
    ? round2(catalogPrice * Math.max(0, shaftLengthMm) / 1000)
    : catalogPrice;
};

/** Expands a quantity map into priced, non-empty quote lines. */
export const buildAccessoryQuoteLines = (
  quantities: Record<string, number>,
  colorMode: AccessoryColorMode,
  shaftLengthMm = 0,
): AccessoryQuoteLine[] => ACCESSORY_ROWS.flatMap((row) => {
  const quantity = Math.max(0, Number(quantities[row.key] ?? 0));
  if (quantity <= 0) return [];
  const unitPrice = resolveAccessoryUnitPrice(row, colorMode, quantity, shaftLengthMm);
  return [{
    row,
    key: row.key,
    quantity,
    isBulk: !row.naturalOnly && quantity >= ACCESSORY_BULK_THRESHOLD,
    unitPrice,
    subtotal: round1(unitPrice * quantity),
  }];
});

export const summarizeAccessoryQuote = (
  quantities: Record<string, number>,
  colorMode: AccessoryColorMode,
  language: Language,
  shaftLengthMm = 0,
): AccessoryQuoteSummary => {
  const lines = buildAccessoryQuoteLines(quantities, colorMode, shaftLengthMm);
  return {
    lines,
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: round1(lines.reduce((sum, line) => sum + line.subtotal, 0)),
    seriesLabel: lines.length
      ? Array.from(new Set(lines.map((line) => getAccessoryRowSeriesLabel(line.row, language)))).join(' / ')
      : '-',
  };
};

/** Clears a single row and drops the key entirely when it reaches zero. */
export const setAccessoryQuantity = (
  quantities: Record<string, number>,
  key: string,
  rawQuantity: number,
): Record<string, number> => {
  const quantity = Math.max(0, Math.floor(Number(rawQuantity) || 0));
  const next = { ...quantities };
  if (quantity <= 0) delete next[key];
  else next[key] = quantity;
  return next;
};
