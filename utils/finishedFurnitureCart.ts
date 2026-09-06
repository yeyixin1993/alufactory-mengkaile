import type { CartItem } from '../types';

export interface FinishedFurnitureCartConfig {
  type: 'finished_furniture';
  finishedFurnitureCategory: 'finished_furniture';
  finishedFurnitureSource: string;
  finishedFurnitureProductId: string;
  finishedFurnitureTotalCny: number;
  parametricSummary: Record<string, number | string>;
  productionItems: CartItem[];
  unitPrice: number;
  hideComponentPrice: true;
  [key: string]: unknown;
}

export const isFinishedFurnitureCartItem = (item: CartItem) => {
  const config = (item.config || {}) as Partial<FinishedFurnitureCartConfig>;
  return config.type === 'finished_furniture'
    && config.finishedFurnitureCategory === 'finished_furniture'
    && Array.isArray(config.productionItems);
};

const scaleProductionConfig = (configInput: unknown, multiplier: number) => {
  const config = configInput && typeof configInput === 'object'
    ? { ...(configInput as Record<string, any>) }
    : {};
  if (Number.isFinite(Number(config.totalQuantity))) {
    config.totalQuantity = Number(config.totalQuantity) * multiplier;
  }
  if (Number.isFinite(Number(config.unitTotal))) {
    config.unitTotal = Number((Number(config.unitTotal) * multiplier).toFixed(2));
  }
  if (config.quantities && typeof config.quantities === 'object') {
    config.quantities = Object.fromEntries(Object.entries(config.quantities).map(([key, value]) => [
      key,
      Number(value || 0) * multiplier,
    ]));
  }
  if (Array.isArray(config.lines)) {
    config.lines = config.lines.map((line: any) => ({
      ...line,
      quantity: Number(line?.quantity || 0) * multiplier,
      subtotal: Number((Number(line?.subtotal || 0) * multiplier).toFixed(2)),
    }));
  }
  return config;
};

/**
 * Expands customer-facing finished-furniture cart rows back into their hidden
 * manufacturing BOM. Ordinary cart rows pass through unchanged.
 */
export const expandFinishedFurnitureCartItems = (cart: CartItem[]): CartItem[] => (
  cart.flatMap((item) => {
    if (!isFinishedFurnitureCartItem(item)) return [item];
    const config = item.config as FinishedFurnitureCartConfig;
    const multiplier = Math.max(1, Math.round(Number(item.quantity) || 1));
    return config.productionItems.slice(0, 20_000).map((productionItem, index) => ({
      ...productionItem,
      id: `${item.id}:production:${index}:${productionItem.id}`,
      quantity: Math.max(1, Number(productionItem.quantity) || 1) * multiplier,
      totalPrice: Number((Number(productionItem.totalPrice || 0) * multiplier).toFixed(2)),
      config: scaleProductionConfig(productionItem.config, multiplier),
    }));
  })
);
