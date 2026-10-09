/**
 * Owner-confirmed links between a *source-model* part and a numbered accessory
 * in the customer catalog.
 *
 * A SketchUp/MayCAD import carries its own component names ("Source fixed
 * support") and its own semantic types (`fixed_support`). Those are source
 * evidence, not catalog identity: nothing in the file says the part is the
 * third item on the customer's numbered accessory chart. The site owner looked
 * at the part in the designer and said so, and this file is where that
 * statement lives — one record per part, in one place, so the designer label,
 * the price and the artwork all read the same decision.
 *
 * The link never invents a size. The profile series is read from the source
 * mesh envelope, and the link only supplies *which* catalog definition the part
 * is; a part whose envelope does not match the recorded module stays a generic
 * source part rather than borrowing a bracket price (fail-closed).
 */
import { ACCESSORY_ROWS, type AccessoryProfileSize, type AccessoryRow } from './accessoryCatalog';

/**
 * How far a modelled arm may sit from a catalog module and still count as that
 * series. The source bracket is modelled at its nominal size, so this only
 * absorbs tessellation/rounding noise — it is not a size tolerance.
 */
export const SOURCE_ACCESSORY_MODULE_TOLERANCE_MM = 1;

export interface DesignerSourceAccessoryLink {
  /** `sourceMesh.source.semanticType` recorded on the imported part. */
  readonly semanticType: string;
  /** Definition id in `data/accessoryCatalog.ts` (`'3'` = 3号角码). */
  readonly definitionId: string;
  /** The customer-facing code the part must quote back in every list. */
  readonly note: string;
}

/**
 * The 凳子 stool's source model places a 27×30×30 right-angle bracket sixteen
 * times. The owner identified it against the numbered accessory chart as
 * **3号角码**, i.e. catalog definition `'3'` — so the designer names it,
 * prices it and illustrates it as No.3 from now on.
 */
export const DESIGNER_SOURCE_ACCESSORY_LINKS: readonly DesignerSourceAccessoryLink[] = [
  {
    semanticType: 'fixed_support',
    definitionId: '3',
    note: '业主确认：源模型的固定支座（27×30×30 直角角码）就是目录里的 3号角码。',
  },
];

const MODULE_SERIES: Readonly<Record<number, AccessoryProfileSize>> = {
  15: '1515',
  20: '2020',
  30: '3030',
  40: '4040',
};

const normalizeSemanticType = (value: unknown) => String(value ?? '').trim().toLowerCase();

export const getDesignerSourceAccessoryLink = (
  semanticType: unknown,
): DesignerSourceAccessoryLink | null => {
  const token = normalizeSemanticType(semanticType);
  if (!token) return null;
  return DESIGNER_SOURCE_ACCESSORY_LINKS.find((link) => link.semanticType === token) ?? null;
};

/**
 * Profile series of a source bracket, read from its own envelope.
 *
 * An angle bracket carries the profile module in its two arms, which are its
 * two largest extents. Both must land on the same catalog module; anything else
 * returns `null` so the caller keeps the generic source-part treatment.
 */
export const resolveSourceBracketSeries = (
  boundsMm: { readonly min: readonly number[]; readonly max: readonly number[] } | null | undefined,
): AccessoryProfileSize | null => {
  if (!boundsMm || !Array.isArray(boundsMm.min) || !Array.isArray(boundsMm.max)) return null;
  const extents: number[] = [];
  for (let axis = 0; axis < 3; axis += 1) {
    const extent = Number(boundsMm.max[axis]) - Number(boundsMm.min[axis]);
    if (!Number.isFinite(extent)) return null;
    extents.push(extent);
  }
  extents.sort((left, right) => right - left);
  const moduleMm = Math.round(extents[1]);
  if (Math.abs(extents[0] - moduleMm) > SOURCE_ACCESSORY_MODULE_TOLERANCE_MM) return null;
  if (Math.abs(extents[1] - moduleMm) > SOURCE_ACCESSORY_MODULE_TOLERANCE_MM) return null;
  return MODULE_SERIES[moduleMm] ?? null;
};

/**
 * The catalog line a source part quotes back, or `null` when the part is not
 * linked / its envelope does not name a series the catalog prices.
 */
export const resolveDesignerSourceAccessoryRow = (
  semanticType: unknown,
  boundsMm: { readonly min: readonly number[]; readonly max: readonly number[] } | null | undefined,
): AccessoryRow | null => {
  const link = getDesignerSourceAccessoryLink(semanticType);
  if (!link) return null;
  const series = resolveSourceBracketSeries(boundsMm);
  if (!series) return null;
  return ACCESSORY_ROWS.find((row) => row.defId === link.definitionId && row.series === series) ?? null;
};
