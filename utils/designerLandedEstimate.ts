/**
 * Landed-price preview for the 3D DIY designer.
 *
 * The designer shows 设计估价 (the parts subtotal) but a customer who ships a
 * finished cabinet to 广州 wants to know what arrives, not what the parts
 * cost. This module answers that question with **the cart's own rules** — the
 * same weight tables, the same per-province tiers, the same overlength fee and
 * the same "cheapest courier" choice — so the number previewed here is the
 * number the cart charges once a real address exists. It is deliberately a
 * *preview*: nothing here is written into the design file or the order.
 */

import {
  PROFILE_WEIGHTS,
  SHIPPING_RATES,
  SHIPPING_RATES_AN,
  SHIPPING_RATES_SF,
} from '../constants';
import { MARINE_BOARD_WEIGHT_PER_SQM } from './quickQuoteCatalog';
import { getAccessoryShippingWeightKg } from './membership';
import type { DIYSceneItem } from './stoolDesignerEngine';

/** Mirrors the cart's overlength rule in `App.tsx` (profiles longer than 1.5 m). */
export const DESIGNER_OVERLENGTH_THRESHOLD_MM = 1500;
export const DESIGNER_OVERLENGTH_FEE = 20;

export type DesignerShippingMethod = 'standard' | 'sf' | 'anneng';

export interface DesignerShippingEstimate {
  province: string;
  profileWeightKg: number;
  marineBoardWeightKg: number;
  accessoryWeightKg: number;
  totalWeightKg: number;
  billedWeightKg: number;
  hasOverlength: boolean;
  fees: Record<DesignerShippingMethod, number>;
  cheapest: DesignerShippingMethod;
  fee: number;
  landed: number;
}

/** The province list is the shipping table itself, never a hand-written copy. */
export const DESIGNER_SHIPPING_PROVINCES: string[] = Object.keys(SHIPPING_RATES).sort();

/**
 * Which scene items become `ProductType.ACCESSORY` in the cart. The cart's
 * 1 kg accessory allowance keys off that product type, so the preview has to
 * classify the same way or the two weights (and totals) would disagree.
 */
const isAccessoryLikeItem = (item: Pick<DIYSceneItem, 'kind'>) => (
  item.kind !== 'profile'
  && item.kind !== 'plate'
  && item.kind !== 'pegboard'
  && item.kind !== 'marine_board'
  && item.kind !== 'cabinet_door'
);

export const designerSceneWeightKg = (
  items: Array<Pick<DIYSceneItem, 'kind' | 'variantId' | 'length' | 'width' | 'height' | 'thickness' | 'quantity'>>,
  subtotalCny: number,
  user?: { membershipLevel?: unknown } | null,
) => {
  const profileWeightKg = items.reduce((sum, item) => {
    if (item.kind !== 'profile') return sum;
    const weightPerM = PROFILE_WEIGHTS[item.variantId || ''] || 0.6;
    return sum + weightPerM * ((item.length || 0) / 1000) * Math.max(1, item.quantity || 1);
  }, 0);

  const marineBoardWeightKg = items.reduce((sum, item) => {
    if (item.kind !== 'marine_board') return sum;
    const weightPerSqm = MARINE_BOARD_WEIGHT_PER_SQM[item.thickness || 18] || 0;
    const areaSqm = ((item.width || 0) * (item.height || 0)) / 1_000_000;
    return sum + weightPerSqm * areaSqm * Math.max(1, item.quantity || 1);
  }, 0);

  const accessoryWeightKg = getAccessoryShippingWeightKg(
    user,
    items.some(isAccessoryLikeItem),
    subtotalCny,
  );

  return {
    profileWeightKg,
    marineBoardWeightKg,
    accessoryWeightKg,
    totalWeightKg: profileWeightKg + marineBoardWeightKg + accessoryWeightKg,
  };
};

export const designHasOverlengthProfile = (
  items: Array<Pick<DIYSceneItem, 'kind' | 'length'>>,
) => items.some((item) => item.kind === 'profile' && (item.length || 0) > DESIGNER_OVERLENGTH_THRESHOLD_MM);

/**
 * The landed preview for one province. Returns `null` when no province (or an
 * unknown one) is selected — the panel then shows the parts subtotal alone,
 * exactly as the cart does before an address exists.
 */
export const estimateDesignerShipping = (
  items: Array<Pick<DIYSceneItem, 'kind' | 'variantId' | 'length' | 'width' | 'height' | 'thickness' | 'quantity'>>,
  subtotalCny: number,
  province: string,
  user?: { membershipLevel?: unknown } | null,
): DesignerShippingEstimate | null => {
  if (!province || !SHIPPING_RATES[province]) return null;

  const { profileWeightKg, marineBoardWeightKg, accessoryWeightKg, totalWeightKg } =
    designerSceneWeightKg(items, subtotalCny, user);
  const hasOverlength = designHasOverlengthProfile(items);

  if (totalWeightKg <= 0) {
    return {
      province,
      profileWeightKg,
      marineBoardWeightKg,
      accessoryWeightKg,
      totalWeightKg,
      billedWeightKg: 0,
      hasOverlength,
      fees: { standard: 0, sf: 0, anneng: 0 },
      cheapest: 'standard',
      fee: 0,
      landed: Number(subtotalCny.toFixed(1)),
    };
  }

  const billedWeightKg = Math.max(1, Math.ceil(totalWeightKg));
  // 到付 is not offered as a preview: the customer has not chosen to pay on
  // delivery yet, and quoting ¥0 would understate what they will be charged.
  const overlength = hasOverlength ? DESIGNER_OVERLENGTH_FEE : 0;
  const standardRate = SHIPPING_RATES[province];
  const sfRate = SHIPPING_RATES_SF[province];
  const anRate = SHIPPING_RATES_AN[province];

  const fees: Record<DesignerShippingMethod, number> = {
    standard: standardRate.first + (billedWeightKg - 1) * standardRate.next + overlength,
    sf: sfRate.first + (billedWeightKg - 1) * sfRate.next + overlength,
    anneng: totalWeightKg <= 15
      ? anRate.first
      : anRate.first + Math.ceil(totalWeightKg - 15) * anRate.next,
  };

  const cheapest: DesignerShippingMethod = (['standard', 'sf', 'anneng'] as const).reduce(
    (best, method) => (fees[method] < fees[best] ? method : best),
    'standard' as DesignerShippingMethod,
  );

  return {
    province,
    profileWeightKg,
    marineBoardWeightKg,
    accessoryWeightKg,
    totalWeightKg,
    billedWeightKg,
    hasOverlength,
    fees,
    cheapest,
    fee: fees[cheapest],
    landed: Number((subtotalCny + fees[cheapest]).toFixed(1)),
  };
};
