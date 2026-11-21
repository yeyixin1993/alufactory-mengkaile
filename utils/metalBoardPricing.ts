import { CartItem, ProductType } from '../types';
/** Minimum area applies to an entire material/thickness/color purchase group. */
export function repriceMetalBoards(items: CartItem[]): CartItem[] {
  const groups = new Map<string, { index: number; area: number; rate: number }[]>();
  items.forEach((item, index) => {
    const c = item.config || {};
    if (![ProductType.ALUMINUM_PLATE, ProductType.PEGBOARD].includes(item.product.type) || c.cabinetDoor) return;
    const area = Number(c.width) * Number(c.height) * item.quantity / 1e6;
    const rate = Number(c.unitRate);
    if (!(area > 0 && rate > 0)) return;
    const key = JSON.stringify([item.product.type, c.thickness, c.colorId || 'natural']);
    groups.set(key, [...(groups.get(key) || []), { index, area, rate }]);
  });
  const result = [...items];
  groups.forEach(rows => {
    const area = rows.reduce((n, r) => n + r.area, 0);
    const factor = Math.max(0.2, area) / area;
    let allocated = 0;
    const total = Math.round(rows.reduce((n, r) => n + r.area * factor * r.rate, 0) * 100);
    rows.forEach((r, i) => {
      const cents = i === rows.length - 1 ? total - allocated : Math.round(r.area * factor * r.rate * 100);
      allocated += cents;
      const item = items[r.index];
      result[r.index] = { ...item, totalPrice: cents / 100, config: { ...item.config, unitPrice: cents / 100 / item.quantity, chargedArea: r.area * factor / item.quantity, minAreaApplied: area < 0.2, pricingRule: 'group-area-v1' } };
    });
  });
  return result;
}
