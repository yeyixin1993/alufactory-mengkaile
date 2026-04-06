import { CartItem, ProductType, ProfileConfig } from '../types';

export const SCREW_304_UNIT_PRICE = 0.5;

export interface ScrewModelSummary {
  model: string;
  countersunkHoles: number;
  throughHoles: number;
  totalHoles: number;
  recommendedScrewCount: number;
}

export interface ScrewPlan {
  include304Screws: boolean;
  models: ScrewModelSummary[];
  totalHoles: number;
  totalRecommendedScrewCount: number;
  totalFee: number;
}

const normalizeScrewModel = (variantId?: string): string | null => {
  const text = String(variantId || '').trim().toUpperCase();
  return text || null;
};

export const calculateScrewPlan = (cart: CartItem[], include304Screws: boolean): ScrewPlan => {
  const map = new Map<string, { countersunk: number; through: number }>();

  cart.forEach((item) => {
    if (item.product.type !== ProductType.PROFILE) return;

    const cfg = item.config as ProfileConfig;
    const model = normalizeScrewModel(cfg.variantId);
    if (!model) return;

    const qty = Number(item.quantity) || 0;
    if (qty <= 0) return;

    const countersunkPerPiece = Array.isArray(cfg.holes)
      ? cfg.holes.filter((h) => h.type === 'countersunk').length
      : 0;
    const throughPerPiece = Array.isArray(cfg.holes)
      ? cfg.holes.filter((h) => h.type === 'through').length
      : 0;

    if (countersunkPerPiece <= 0 && throughPerPiece <= 0) return;

    const existing = map.get(model) || { countersunk: 0, through: 0 };
    existing.countersunk += countersunkPerPiece * qty;
    existing.through += throughPerPiece * qty;
    map.set(model, existing);
  });

  const models: ScrewModelSummary[] = Array.from(map.entries())
    .map(([model, counts]) => {
      const totalHoles = counts.countersunk + counts.through;
      const recommendedScrewCount = include304Screws ? totalHoles : 0;

      return {
        model,
        countersunkHoles: counts.countersunk,
        throughHoles: counts.through,
        totalHoles,
        recommendedScrewCount,
      };
    })
    .sort((a, b) => a.model.localeCompare(b.model));

  const totalHoles = models.reduce((sum, m) => sum + m.totalHoles, 0);
  const totalRecommendedScrewCount = models.reduce((sum, m) => sum + m.recommendedScrewCount, 0);
  const totalFee = include304Screws ? totalRecommendedScrewCount * SCREW_304_UNIT_PRICE : 0;

  return {
    include304Screws,
    models,
    totalHoles,
    totalRecommendedScrewCount,
    totalFee,
  };
};

export const inferInclude304ScrewsByTotal = (
  cart: CartItem[],
  shippingFee: number,
  totalAmount: number,
  tolerance = 0.25,
): boolean => {
  const base = cart.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0) + (Number(shippingFee) || 0);
  const withScrewTotal = base + calculateScrewPlan(cart, true).totalFee;
  return Math.abs((Number(totalAmount) || 0) - withScrewTotal) <= tolerance;
};
