/**
 * Pure pricing rules for the 3D DIY designer's hardware outside the
 * profile / board / cabinet-door families.
 *
 * Two separate facts are kept apart on purpose:
 * 1. a price the site owner has already confirmed (shaft per metre, support
 *    per piece, the standard caster tier, the 诺贝 upgrade tier);
 * 2. a part that is still unpriced (`status: 'pending'`). Those contribute
 *    ¥0 to the running total so the displayed number never invents money.
 *
 * Imported source components (`kind: 'imported_component'`) used to fall
 * through to `item.accessoryPrice || 0`, which silently priced a whole source
 * model at zero. They are now classified from their own recorded evidence —
 * never from a component name alone — and priced with the rules below.
 */
import { DISPLAY_RACK_COMPONENT_CATALOG } from '../data/displayRackComponentCatalog';

export type WheelGrade = 'standard' | 'upgraded';
export type CasterThreadSize = 'M6' | 'M8' | 'M10' | 'M12';

/** Standard wheel tiers, unchanged from the original caster pricing. */
export const CASTER_BASE_UNIT_PRICE = 18;
export const CASTER_BRAKE_SURCHARGE = 4;
export const CASTER_THREAD_SURCHARGE: Readonly<Record<CasterThreadSize, number>> = {
  M6: 0,
  M8: 0,
  M10: 2,
  M12: 4,
};

/** Owner-confirmed upgrade price per wheel (诺贝 wheel option). */
export const UPGRADED_WHEEL_UNIT_PRICE = 50;
export const DEFAULT_WHEEL_GRADE: WheelGrade = 'standard';

/**
 * Owner-confirmed prices for the two imported source parts that used to be
 * explicitly pending. They are provisional ("暂时") but real numbers now, so
 * the status is `confirmed` rather than `pending`.
 *
 * The pair is calibrated, not chosen: the 凳子 reference design (upgraded 诺贝
 * wheels, shipped to 浙江) has to land on the owner-confirmed ¥880, which fixes
 * the two together at ¥87.12. The owner pinned 8080 装饰料 at a round **¥8/件**
 * and asked for the remainder to land on the 拉手, so the handle carries
 * `87.12 - 8 × 8 = ¥23.12`. `npm run test:stool-landed-total` freezes that
 * arithmetic against the real fixture, so the total cannot drift silently.
 */
export const HANDLE_UNIT_PRICE = 23.12;
export const DECORATIVE_PROFILE_UNIT_PRICE = 8;

/**
 * Family prices already confirmed on site. Every shaft diameter reuses the
 * recorded per-metre basis and every support reuses the recorded per-piece
 * basis until a diameter-specific price is confirmed; nothing is scaled by
 * weight or guessed from a photograph.
 */
export const SHAFT_UNIT_PRICE_PER_M = DISPLAY_RACK_COMPONENT_CATALOG.SHAFT_8.unitPriceCny;
export const SHAFT_SUPPORT_UNIT_PRICE = DISPLAY_RACK_COMPONENT_CATALOG.SK8.unitPriceCny;

export const normalizeWheelGrade = (value: unknown): WheelGrade => (
  String(value) === 'upgraded' ? 'upgraded' : DEFAULT_WHEEL_GRADE
);

export const resolveCasterUnitPrice = (input: {
  accessoryThreadSize?: string | null;
  hasBrake?: boolean | null;
  wheelGrade?: unknown;
}) => {
  if (normalizeWheelGrade(input.wheelGrade) === 'upgraded') return UPGRADED_WHEEL_UNIT_PRICE;
  const threadSize = (input.accessoryThreadSize || 'M8') as CasterThreadSize;
  return CASTER_BASE_UNIT_PRICE
    + (CASTER_THREAD_SURCHARGE[threadSize] ?? 0)
    + (input.hasBrake ? CASTER_BRAKE_SURCHARGE : 0);
};

export const resolveShaftUnitPrice = (lengthMm: number) => (
  Number(((Math.max(0, Number(lengthMm) || 0) / 1000) * SHAFT_UNIT_PRICE_PER_M).toFixed(2))
);

export type ImportedComponentCategory =
  | 'linear_shaft'
  | 'shaft_support'
  | 'caster'
  | 'handle'
  | 'decorative_profile'
  | 'unknown';

export type ImportedComponentPriceBasis = 'length' | 'piece';
export type ImportedComponentPriceStatus = 'confirmed' | 'pending';

export interface ImportedComponentPrice {
  /** Unit price in CNY for one piece. `0` whenever the status is pending. */
  readonly unitPrice: number;
  readonly category: ImportedComponentCategory;
  readonly basis: ImportedComponentPriceBasis;
  readonly status: ImportedComponentPriceStatus;
  /** Shaft length used by the length-priced basis, in mm. */
  readonly lengthMm: number | null;
}

export interface ImportedComponentPricingInput {
  /** `sourceMesh.source.semanticType`, e.g. `shaft`, `shaft_support`, `fixed_support`. */
  semanticType?: string | null;
  /** `sourceMesh.source.componentName` or the scene item name. */
  componentName?: string | null;
  /** `partCatalogRef.catalogItemId` when the accessory catalog identified the mesh. */
  catalogItemId?: string | null;
  /** `partCatalogRef.sourceRecordId` when the accessory catalog identified the mesh. */
  sourceRecordId?: string | null;
  /** Explicit scene length, when the item records one. */
  lengthMm?: number | null;
  /** Source mesh local envelope; the longest axis is the shaft's cut length. */
  boundsMm?: { min: readonly number[]; max: readonly number[] } | null;
  wheelGrade?: unknown;
  accessoryThreadSize?: string | null;
  hasBrake?: boolean | null;
}

const normalizeToken = (value: unknown) => String(value ?? '').trim().toLowerCase();

/** Longest local-envelope axis: a shaft is long, thin and cut along that axis. */
export const getLongestEnvelopeAxisMm = (
  boundsMm: { min: readonly number[]; max: readonly number[] } | null | undefined,
) => {
  if (!boundsMm || !Array.isArray(boundsMm.min) || !Array.isArray(boundsMm.max)) return 0;
  let longest = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const extent = Number(boundsMm.max[axis]) - Number(boundsMm.min[axis]);
    if (Number.isFinite(extent) && extent > longest) longest = extent;
  }
  return Number(longest.toFixed(2));
};

export const resolveShaftLengthMm = (input: Pick<ImportedComponentPricingInput, 'lengthMm' | 'boundsMm'>) => {
  const explicit = Number(input.lengthMm);
  if (Number.isFinite(explicit) && explicit > 0) return Number(explicit.toFixed(2));
  return getLongestEnvelopeAxisMm(input.boundsMm);
};

const ACCESSORY_SOURCE_RECORDS = new Set([
  'brake_caster_source',
  'stainless_handle_126',
  'decorative_8080_30',
]);

/**
 * Classify from recorded evidence first (catalog identity, then semantic type),
 * and only then from the name. A name match alone never promotes a part to a
 * priced category unless the name carries the same technical token.
 */
export const classifyImportedComponent = (
  input: Pick<ImportedComponentPricingInput, 'semanticType' | 'componentName' | 'catalogItemId' | 'sourceRecordId'>,
): ImportedComponentCategory => {
  const semanticType = normalizeToken(input.semanticType);
  const sourceRecordId = normalizeToken(input.sourceRecordId);
  const catalogItemId = normalizeToken(input.catalogItemId);
  const name = normalizeToken(input.componentName);
  const identity = `${semanticType} ${sourceRecordId} ${catalogItemId}`;

  const isKnownAccessoryRecord = ACCESSORY_SOURCE_RECORDS.has(sourceRecordId)
    || Array.from(ACCESSORY_SOURCE_RECORDS).some((record) => identity.includes(record));
  if (isKnownAccessoryRecord || semanticType === 'stool_accessory:caster') {
    if (identity.includes('brake_caster_source') || semanticType === 'caster' || name.includes('脚轮') || name.includes('caster')) {
      return 'caster';
    }
    if (identity.includes('stainless_handle_126') || semanticType === 'handle' || name.includes('拉手') || name.includes('handle')) {
      return 'handle';
    }
    if (identity.includes('decorative_8080_30') || semanticType === 'decorative_profile') {
      return 'decorative_profile';
    }
  }
  if (semanticType === 'caster') return 'caster';
  if (semanticType === 'handle') return 'handle';
  if (semanticType === 'decorative_profile') return 'decorative_profile';
  if (semanticType === 'shaft' || semanticType === 'linear_shaft') return 'linear_shaft';
  if (semanticType === 'shaft_support' || semanticType === 'fixed_support') return 'shaft_support';
  if (name.includes('光轴') || /(^|\s)shaft(\s|$)/.test(name) || name.startsWith('shaft')) return 'linear_shaft';
  if (name.includes('支座') || name.includes('支撑') || name.includes('support')) return 'shaft_support';
  if (name.includes('拉手')) return 'handle';
  if (name.includes('8080')) return 'decorative_profile';
  return 'unknown';
};

const pending = (category: ImportedComponentCategory, basis: ImportedComponentPriceBasis): ImportedComponentPrice => ({
  unitPrice: 0,
  category,
  basis,
  status: 'pending',
  lengthMm: null,
});

const perPiece = (category: ImportedComponentCategory, unitPrice: number): ImportedComponentPrice => ({
  unitPrice,
  category,
  basis: 'piece',
  status: 'confirmed',
  lengthMm: null,
});

/**
 * Unit price for one imported source component.
 *
 * - 光轴 → length-priced at the confirmed per-metre shaft price.
 * - 支撑座（SHF/SK 系列、源模型固定支座）→ the confirmed per-piece support price.
 * - 轮子 → the selected wheel tier: standard keeps the original caster price,
 *   the 诺贝 upgrade is a flat price per wheel.
 * - 拉手 → the owner-confirmed per-piece price.
 * - 8080 装饰料 → the owner-confirmed per-piece price.
 * - anything else → `0` with `status: 'pending'`, never an invented number.
 */
export const resolveImportedComponentPrice = (
  input: ImportedComponentPricingInput,
): ImportedComponentPrice => {
  const category = classifyImportedComponent(input);
  if (category === 'linear_shaft') {
    const lengthMm = resolveShaftLengthMm(input);
    return {
      unitPrice: resolveShaftUnitPrice(lengthMm),
      category,
      basis: 'length',
      status: 'confirmed',
      lengthMm: lengthMm > 0 ? lengthMm : null,
    };
  }
  if (category === 'shaft_support') {
    return { unitPrice: SHAFT_SUPPORT_UNIT_PRICE, category, basis: 'piece', status: 'confirmed', lengthMm: null };
  }
  if (category === 'caster') {
    return {
      unitPrice: resolveCasterUnitPrice({
        accessoryThreadSize: input.accessoryThreadSize,
        // The source mesh is the braked caster; a plain source part stays plain.
        hasBrake: input.hasBrake ?? true,
        wheelGrade: input.wheelGrade,
      }),
      category,
      basis: 'piece',
      status: 'confirmed',
      lengthMm: null,
    };
  }
  if (category === 'handle') return perPiece(category, HANDLE_UNIT_PRICE);
  if (category === 'decorative_profile') return perPiece(category, DECORATIVE_PROFILE_UNIT_PRICE);
  return pending(category, 'piece');
};

export const IMPORTED_COMPONENT_PRICING_SCHEME = {
  shaftPriceUnit: 'meter',
  shaftUnitPriceCny: SHAFT_UNIT_PRICE_PER_M,
  supportPriceUnit: 'piece',
  supportUnitPriceCny: SHAFT_SUPPORT_UNIT_PRICE,
  standardWheelBasePriceCny: CASTER_BASE_UNIT_PRICE,
  standardWheelBrakeSurchargeCny: CASTER_BRAKE_SURCHARGE,
  upgradedWheelUnitPriceCny: UPGRADED_WHEEL_UNIT_PRICE,
  handleUnitPriceCny: HANDLE_UNIT_PRICE,
  decorativeProfileUnitPriceCny: DECORATIVE_PROFILE_UNIT_PRICE,
} as const;
