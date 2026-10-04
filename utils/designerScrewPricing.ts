/**
 * Pure pricing for the designer's screw lines.
 *
 * A screw is the only part the designer identifies from a *machining rule*
 * (profile series + head → thread + length) rather than from a picked SKU, so
 * it used to have no catalog identity at all and fell through to
 * `item.accessoryPrice || 0`. On a generated product (the 凳子 template) the
 * recorded field was absent and every screw silently became ¥0.
 *
 * The rule is now:
 *
 * 1. an exact accessory-catalog row for the specification wins
 *    (`10_3030_m8x45_cap`) — the catalog stays the single source of truth;
 * 2. otherwise the length-agnostic row for that series + head + thread wins
 *    (`10_1515_m4_cap`), used when the design rule has no confirmed length;
 * 3. otherwise the owner-confirmed flat default applies.
 *
 * A screw therefore never costs ¥0. Specifications the accessory catalog did
 * not carry are generated into it by `data/designerScrewAccessoryCatalog.ts`,
 * so step 3 is a safety net rather than the normal path.
 */
import { ACCESSORY_ROWS, type AccessoryRow } from '../data/accessoryCatalog';
import { DESIGNER_SCREW_REFERENCE_SPECS } from '../data/designerScrewAccessoryCatalog';
import type { ScrewHeadType } from '../types';
import {
  DEFAULT_SCREW_UNIT_PRICE,
  buildScrewAccessoryDefinitionId,
  inferScrewThreadSizeForSeries,
  resolveScrewUnitPriceForSeries,
} from './screwSpecIdentity';

export { DEFAULT_SCREW_UNIT_PRICE };

/** Where a screw's unit price came from. */
export type ScrewPriceSource = 'catalog_exact' | 'catalog_series' | 'default';

export interface ScrewPricingInput {
  /** Profile series the screw is fitted to, e.g. `3030`. */
  profileSize?: string | null;
  screwHead?: ScrewHeadType | null;
  /** Thread size resolved by the designer's order-spec rule. */
  threadSize?: string | null;
  /** Order length in mm. Omit when the rule has no confirmed length. */
  lengthMm?: number | null;
}

export interface ResolvedScrewPrice {
  /** Unit price in CNY for one screw. Never `0`. */
  unitPrice: number;
  source: ScrewPriceSource;
  /** Catalog definition id the specification resolved to, when one exists. */
  accessoryDefinitionId: string | null;
  /** `defId::series` row key, for carts that reference the catalog directly. */
  accessoryRowKey: string | null;
  /** The exact id this specification would need, if the catalog lacks it. */
  requestedDefinitionId: string | null;
}

export const findScrewAccessoryRow = (definitionId: string): AccessoryRow | null => (
  ACCESSORY_ROWS.find((row) => row.defId === definitionId) || null
);

const unresolved = (
  requestedDefinitionId: string | null,
  unitPrice = DEFAULT_SCREW_UNIT_PRICE,
): ResolvedScrewPrice => ({
  unitPrice,
  source: 'default',
  accessoryDefinitionId: null,
  accessoryRowKey: null,
  requestedDefinitionId,
});

/**
 * Unit price for one screw. Exact catalog identity first, then the
 * length-agnostic series identity, then the owner-confirmed flat default.
 */
export const resolveDesignerScrewPrice = (input: ScrewPricingInput): ResolvedScrewPrice => {
  const series = String(input.profileSize || '').trim();
  const screwHead = input.screwHead;
  if (!series || !screwHead) return unresolved(null);

  const threadSize = String(input.threadSize || '').trim() || inferScrewThreadSizeForSeries(series);
  const lengthMm = Number(input.lengthMm);
  const hasLength = Number.isFinite(lengthMm) && lengthMm > 0;

  const exactId = hasLength
    ? buildScrewAccessoryDefinitionId({ series, threadSize, screwHead, lengthMm })
    : null;
  if (exactId) {
    const exactRow = findScrewAccessoryRow(exactId);
    if (exactRow) {
      return {
        unitPrice: exactRow.price.natural,
        source: 'catalog_exact',
        accessoryDefinitionId: exactRow.defId,
        accessoryRowKey: exactRow.key,
        requestedDefinitionId: exactId,
      };
    }
  }

  const seriesId = buildScrewAccessoryDefinitionId({ series, threadSize, screwHead, lengthMm: null });
  const seriesRow = findScrewAccessoryRow(seriesId);
  if (seriesRow) {
    return {
      unitPrice: seriesRow.price.natural,
      source: 'catalog_series',
      accessoryDefinitionId: seriesRow.defId,
      accessoryRowKey: seriesRow.key,
      requestedDefinitionId: exactId || seriesId,
    };
  }

  // Safety net only: the catalog carries every series × head the designer can
  // reach, so this branch means the series itself is unknown. Keep the
  // series ladder anyway, so an unknown series is never cheaper than a 3030.
  return unresolved(exactId || seriesId, resolveScrewUnitPriceForSeries(series));
};

export interface MissingScrewSpecification {
  series: string;
  screwHead: ScrewHeadType;
  threadSize: string;
  requestedDefinitionId: string;
}

/**
 * Audit helper: every specification the designer can reach that would still
 * fall back to the flat default because the accessory catalog has no row for
 * it. Empty for the standard profile series — that emptiness *is* the
 * "an unrecognised specification gets added to the accessory list" contract.
 */
export const listUnregisteredDesignerScrewSpecifications = (): MissingScrewSpecification[] => (
  DESIGNER_SCREW_REFERENCE_SPECS.flatMap((spec): MissingScrewSpecification[] => {
    const resolved = resolveDesignerScrewPrice({
      profileSize: spec.series,
      screwHead: spec.screwHead,
      threadSize: spec.threadSize,
      lengthMm: spec.lengthMm,
    });
    if (resolved.source !== 'default') return [];
    return [{
      series: spec.series,
      screwHead: spec.screwHead,
      threadSize: spec.threadSize,
      requestedDefinitionId: String(resolved.requestedDefinitionId || ''),
    }];
  })
);
