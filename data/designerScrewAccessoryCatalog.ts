/**
 * No.10 screw lines the designer needs but the hand-written accessory catalog
 * did not carry yet.
 *
 * The designer emits structural screws from a machining rule (profile series +
 * head + thread + length) rather than from a picked SKU, so a design could ask
 * for a screw the accessory catalog had never heard of. Those specifications
 * were priced at ¥0 and were invisible to the accessory list. This module
 * derives the missing rows so that:
 *
 * 1. every screw specification the designer can produce has a No.10 identity
 *    in `data/accessoryCatalog.ts` (and therefore a price the design can use);
 * 2. nothing is ever billed at ¥0 — an unpriced specification uses the
 *    owner-confirmed per-series price (1515/2020 ¥0.5, 3030 ¥0.75, 4040 ¥1.5).
 *
 * Two kinds of row are generated:
 * - **confirmed length** — the design rule fixes thread *and* length, so the
 *   row is an exact order SKU (`10_3030_m8x45_cap`) and stays customer-facing;
 * - **series family** — one row per profile series × head that covers every
 *   other length, because the designer derives those from the modelled
 *   geometry (`10_3030_m8_cap`, "长度按设计取值"). These are flagged
 *   `designerInternalOnly`: the identity keeps the price resolvable, but the
 *   row is filtered out of every customer-facing accessory list.
 *
 * The family rows are what make the contract hold: however the geometry moves,
 * the specification still resolves to an accessory-catalog line instead of an
 * anonymous ¥0 part.
 */
import type { ScrewHeadType } from '../types';
import type { AccessoryDefinition, AccessoryProfileSize } from './accessoryCatalog';
import { DESIGNER_FASTENER_CATALOG } from './designerFastenerCatalog';
import {
  SCREW_HEAD_NAMES,
  SCREW_HEAD_STANDARD,
  buildScrewAccessoryDefinitionId,
  inferScrewThreadSizeForSeries,
  resolveScrewUnitPriceForSeries,
  type ScrewSpecIdentity,
} from '../utils/screwSpecIdentity';

/** Profile series the designer can attach a screw to. */
export const DESIGNER_SCREW_SERIES: readonly AccessoryProfileSize[] = ['1515', '2020', '3030', '4040'];

/** Every screw head the designer can produce. */
export const DESIGNER_SCREW_HEADS: readonly ScrewHeadType[] = ['socket_cylinder', 'button_socket', 'flat_socket'];

/** The design rule confirmed for one profile series + head, when there is one. */
export const findConfirmedDesignerScrewRule = (series: string, screwHead: ScrewHeadType) => (
  DESIGNER_FASTENER_CATALOG.find((entry) => entry.profileId === series && entry.headType === screwHead) || null
);

/** Design-rule-confirmed identities, taken straight from the fastener catalog. */
export const CONFIRMED_DESIGNER_SCREW_SPECS: readonly ScrewSpecIdentity[] = DESIGNER_FASTENER_CATALOG.map((entry) => ({
  series: entry.profileId,
  threadSize: entry.threadSize,
  lengthMm: entry.lengthMm,
  screwHead: entry.headType,
}));

/**
 * The specification the designer actually reaches for a series + head: the
 * confirmed rule when one exists, otherwise the series-derived thread with the
 * length left open.
 */
export const DESIGNER_SCREW_REFERENCE_SPECS: readonly ScrewSpecIdentity[] = DESIGNER_SCREW_SERIES.flatMap((series) => (
  DESIGNER_SCREW_HEADS.map((screwHead): ScrewSpecIdentity => {
    const confirmed = findConfirmedDesignerScrewRule(series, screwHead);
    return confirmed
      ? { series, screwHead, threadSize: confirmed.threadSize, lengthMm: confirmed.lengthMm }
      : { series, screwHead, threadSize: inferScrewThreadSizeForSeries(series), lengthMm: null };
  })
));

const buildPrices = (series: string): AccessoryDefinition['prices'] => {
  const unitPrice = resolveScrewUnitPriceForSeries(series);
  return {
    [series]: {
      natural: unitPrice,
      colored: unitPrice,
      naturalBulk: unitPrice,
      coloredBulk: unitPrice,
    },
  };
};

const buildName = (spec: ScrewSpecIdentity) => {
  const head = SCREW_HEAD_NAMES[spec.screwHead];
  const length = Number(spec.lengthMm);
  const hasLength = Number.isFinite(length) && length > 0;
  const dimensionsCn = hasLength ? `${spec.threadSize}*${length}` : spec.threadSize;
  const hint = hasLength
    ? { cn: '', en: '', jp: '' }
    : { cn: '（长度按设计取值）', en: ' (length from design)', jp: '（長さは設計値）' };
  return {
    cn: `10号螺丝 · 304 ${dimensionsCn} ${head.cn}${hint.cn}`,
    en: `No.10 Screw · 304 ${dimensionsCn} ${head.en}${hint.en}`,
    jp: `10番ねじ · 304 ${dimensionsCn} ${head.jp}${hint.jp}`,
  };
};

const buildDefinition = (
  spec: ScrewSpecIdentity,
  note: string,
  designerInternalOnly = false,
): AccessoryDefinition => ({
  id: buildScrewAccessoryDefinitionId(spec),
  code: 10,
  name: buildName(spec),
  note,
  designerInternalOnly: designerInternalOnly || undefined,
  imageKey: '10',
  prices: buildPrices(spec.series),
});

/** Confirmed rule → exact purchasable order SKU, e.g. `10_3030_m8x45_cap`. */
export const DESIGNER_CONFIRMED_SCREW_DEFINITIONS: AccessoryDefinition[] = CONFIRMED_DESIGNER_SCREW_SPECS.map((spec) => {
  const entry = findConfirmedDesignerScrewRule(spec.series, spec.screwHead);
  const kit = entry?.includesElasticFastener ? '＋弹性紧固件' : '';
  const rule = entry?.evidence.designRule || '';
  return buildDefinition(spec, `设计器结构螺丝 · ${spec.series} · ${SCREW_HEAD_STANDARD[spec.screwHead]}${kit} · ${rule}`.trim());
});

/**
 * Length-agnostic family row, one per profile series × head. Every other length
 * the design rule produces resolves here, so an unrecognised specification can
 * never fall outside the accessory list.
 *
 * These rows are `designerInternalOnly`: their length comes from the modelled
 * geometry, so there is nothing a customer could meaningfully pick from a list.
 * They keep their catalog identity (and therefore their price) but are filtered
 * out of the storefront accessory list, the quick quote and the printed VIP
 * price list.
 */
export const DESIGNER_SCREW_FAMILY_DEFINITIONS: AccessoryDefinition[] = DESIGNER_SCREW_SERIES.flatMap((series) => (
  DESIGNER_SCREW_HEADS.flatMap((screwHead): AccessoryDefinition[] => {
    const confirmed = findConfirmedDesignerScrewRule(series, screwHead);
    const threadSize = confirmed?.threadSize || inferScrewThreadSizeForSeries(series);
    const note = confirmed
      ? `设计器结构螺丝 · ${series} · 长度按设计取值（已确认 ${confirmed.threadSize}×${confirmed.lengthMm}）`
      : `设计器结构螺丝 · ${series} · 长度按设计取值`;
    return [buildDefinition({ series, screwHead, threadSize, lengthMm: null }, note, true)];
  })
));

/** Everything this module contributes to the accessory catalog, in order. */
export const DESIGNER_SCREW_ACCESSORY_DEFINITIONS: AccessoryDefinition[] = [
  ...DESIGNER_CONFIRMED_SCREW_DEFINITIONS,
  ...DESIGNER_SCREW_FAMILY_DEFINITIONS,
];
