/**
 * Identity rules for the designer's No.10 screw lines.
 *
 * Screws are the only accessory family whose commercial identity is *derived*
 * from a machining rule (profile series + head + thread + length) instead of a
 * hand-authored SKU. This leaf module owns that spelling so the accessory
 * catalog, the pricing resolver and the regression scripts can never drift.
 *
 * The only prices that live here are the owner-confirmed fallbacks: the flat
 * default for a specification nobody has priced, and the per-series ladder
 * (3030 ¥0.75, 4040 ¥1.5) that the generated catalog rows are built from. Every
 * other screw price comes from `data/accessoryCatalog.ts`, which stays the
 * single source of truth.
 */
import type { ScrewHeadType } from '../types';

/**
 * Owner-confirmed flat price (CNY per piece) for any screw specification that
 * has no recorded price anywhere. A screw is never allowed to fall through to
 * ¥0: an unpriced specification bills at this value and is registered in the
 * accessory catalog so production can still see and order it.
 */
export const DEFAULT_SCREW_UNIT_PRICE = 0.5;

/**
 * Screw price per profile series, in CNY per piece.
 *
 * The flat default covers a specification nobody has priced, but the standard
 * profile series keep their long-standing ladder instead of collapsing onto the
 * flat number: a 3030 screw stays ¥0.75 and a 4040 screw ¥1.5. 1515/2020 sit at
 * the flat default, which is why those two happen to agree with it.
 *
 * The ladder is written out per series rather than derived from the module
 * size, so a nonsense series falls back to the flat default instead of
 * inheriting a large-profile price.
 */
export const SCREW_UNIT_PRICE_BY_SERIES: Readonly<Record<string, number>> = {
  '1515': DEFAULT_SCREW_UNIT_PRICE,
  '2020': DEFAULT_SCREW_UNIT_PRICE,
  '3030': 0.75,
  '4040': 1.5,
};

/**
 * Screw price for one profile series, e.g. `3030` → ¥0.75. A series without a
 * recorded tier falls back to the flat default.
 */
export const resolveScrewUnitPriceForSeries = (series: string) => (
  SCREW_UNIT_PRICE_BY_SERIES[String(series || '').trim()] ?? DEFAULT_SCREW_UNIT_PRICE
);

/**
 * Accessory-catalog id suffix per screw head, matching the authored No.10 rows
 * (`10_3030_m8x20_cs`, `10_1515_m4x6_cap`, …).
 */
export const SCREW_HEAD_ID_SUFFIX: Readonly<Record<ScrewHeadType, string>> = {
  socket_cylinder: 'cap',
  button_socket: 'btn',
  flat_socket: 'cs',
};

/** Ordering standard per head family, used on the generated catalog rows. */
export const SCREW_HEAD_STANDARD: Readonly<Record<ScrewHeadType, string>> = {
  socket_cylinder: 'ISO 4762',
  button_socket: 'ISO 7380-1',
  flat_socket: 'ISO 10642',
};

/** Bilingual naming used by the generated accessory rows. */
export const SCREW_HEAD_NAMES: Readonly<Record<ScrewHeadType, { cn: string; en: string; jp: string }>> = {
  socket_cylinder: { cn: '圆柱头内六角', en: 'Socket Cap', jp: '六角穴付きボルト' },
  button_socket: { cn: '按钮头内六角', en: 'Button-Head Socket', jp: '六角穴付きボタンボルト' },
  flat_socket: { cn: '沉头内六角', en: 'Countersunk Socket', jp: '皿六角' },
};

/** Whole millimetres print bare; a fractional length keeps one decimal. */
export const formatScrewLength = (lengthMm: number) => {
  const value = Math.max(0, Number(lengthMm) || 0);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

/** `M4` + `10` → `m4x10`. The thread token is normalised to lower case. */
export const buildScrewSizeToken = (threadSize: string, lengthMm: number) => (
  `${String(threadSize || '').trim().toLowerCase()}x${formatScrewLength(lengthMm)}`
);

/**
 * One screw specification.
 *
 * `lengthMm` is optional on purpose: a profile series whose purchasing rule has
 * not been confirmed yet is registered as a length-agnostic line, because the
 * designer derives that length from the modelled geometry rather than from a
 * catalog rule.
 */
export interface ScrewSpecIdentity {
  series: string;
  threadSize: string;
  screwHead: ScrewHeadType;
  lengthMm?: number | null;
}

/**
 * Accessory-catalog definition id for one screw specification, e.g.
 * `10_3030_m8x45_cap`, or the length-agnostic `10_1515_m4_cap` when the
 * specification has no confirmed length. Matches the authored No.10 rows
 * exactly, so a generated row and a hand-written row can never diverge.
 */
export const buildScrewAccessoryDefinitionId = (spec: ScrewSpecIdentity) => {
  const length = Number(spec.lengthMm);
  const sizeToken = Number.isFinite(length) && length > 0
    ? buildScrewSizeToken(spec.threadSize, length)
    : String(spec.threadSize || '').trim().toLowerCase();
  return `10_${spec.series}_${sizeToken}_${SCREW_HEAD_ID_SUFFIX[spec.screwHead]}`;
};

/** Thread size the designer infers when no purchasing rule exists yet. */
export const inferScrewThreadSizeForSeries = (series: string) => {
  const moduleSize = Number(String(series || '').slice(0, 2));
  if (moduleSize <= 15) return 'M4';
  if (moduleSize <= 20) return 'M6';
  return 'M8';
};
