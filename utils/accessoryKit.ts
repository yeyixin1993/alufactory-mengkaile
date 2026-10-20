import { ACCESSORY_ROWS, type AccessoryRow, type AccessoryColorMode } from '../data/accessoryCatalog';
import type { Language } from '../types';
import { ACCESSORY_BULK_THRESHOLD } from './accessoryPricing';

export const KIT_SCREW_DISCOUNT = 0.5;
export const KIT_RATIOS: Record<string, [number, number]> = { '1': [2, 2], '2': [2, 2], '3': [2, 2], '7L': [4, 4], '7T': [4, 4], '9': [3, 0] };
// Only catalog-confirmed installation specifications; never substitute a structural screw.
const SPECS: Record<string, Record<string, string>> = {
  '1515': { '3': 'm4x6_cap', '2': 'm4x12_cap', '7L': 'm4x6_cap', '7T': 'm4x6_cap', '9': 'm4x10_cs' },
  '2020': { '3': 'm5x8_cap', '2': 'm5x14_cap', '7L': 'm5x8_cap', '7T': 'm5x8_cap', '9': 'm6x20_cs' },
  '3030': { '3': 'm6x12_cap', '2': 'm6x18_cap', '7L': 'm6x12_cap', '7T': 'm6x12_cap', '9': 'm8x20_cs' },
};
const NUTS: Record<string, string> = { '1515': 'm4_tnut', '2020': 'm5_tnut', '3030': 'm6_tnut' };
export const roundKitMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export interface KitLine {
  id: string; code: number; name: string; series: string; imageKey?: string;
  quantity: number; unitPrice: number; subtotal: number; isBulk: boolean;
  kitParentKey: string; kitRole: 'screw' | 'nut'; originalUnitPrice: number;
}
export function getAccessoryKit(defId: string, series: string) {
  if (series === '4040') return null;
  const ratio = KIT_RATIOS[defId];
  if (defId === '1' && ['2020', '3030'].includes(series)) {
    const placeholder = (role: 'screw' | 'nut'): AccessoryRow => ({
      key: `included_no1_${role}::${series}`, defId: `included_no1_${role}`, code: 10, series: series as '2020' | '3030',
      name: { cn: `1号配套${role === 'screw' ? '螺丝' : '螺母'}（规格待补）`, en: `No.1 ${role} (specification pending)`, jp: `1番 ${role}（仕様未登録）` },
      price: { natural: 0, colored: 0, naturalBulk: 0, coloredBulk: 0 },
    });
    return { screw: placeholder('screw'), nut: placeholder('nut'), screws: 2, nuts: 2 };
  }
  const spec = SPECS[series]?.[defId];
  if (!ratio || !spec) return null;
  const screw = ACCESSORY_ROWS.find(r => r.defId === `10_${series}_${spec}` && r.series === series);
  const nut = ratio[1] ? ACCESSORY_ROWS.find(r => r.defId === `10_${series}_${NUTS[series]}` && r.series === series) : undefined;
  return screw && (!ratio[1] || nut) ? { screw, nut, screws: ratio[0], nuts: ratio[1] } : null;
}
export function buildAccessoryKitLines(defId: string, series: string, quantity: number, color: AccessoryColorMode, language: Language, parentKey = `${defId}::${series}`): KitLine[] {
  const kit = getAccessoryKit(defId, series);
  if (!kit || quantity <= 0) return [];
  const line = (row: AccessoryRow, count: number, role: 'screw' | 'nut'): KitLine => {
    const qty = count * quantity;
    const isBulk = qty >= ACCESSORY_BULK_THRESHOLD;
    const originalUnitPrice = color === 'natural' ? (isBulk ? row.price.naturalBulk : row.price.natural) : (isBulk ? row.price.coloredBulk : row.price.colored);
    // Keep sub-fen unit precision (e.g. 0.33 / 2); round only the line payable.
    const included = defId === '1' || defId === '3';
    const unitPrice = included ? 0 : originalUnitPrice * (role === 'screw' ? KIT_SCREW_DISCOUNT : 1);
    return { id: row.key, code: row.code, name: `${row.name[language]} · ${included ? (language === 'cn' ? '已含配发，不另收费' : 'Included') : role === 'screw' ? (language === 'cn' ? '套装五折' : 'Kit 50%') : (language === 'cn' ? '套装配套' : 'Kit')}`, series, imageKey: row.imageKey || row.defId, quantity: qty, unitPrice, subtotal: roundKitMoney(unitPrice * qty), isBulk, kitParentKey: parentKey, kitRole: role, originalUnitPrice };
  };
  return [line(kit.screw, kit.screws, 'screw'), ...(kit.nut ? [line(kit.nut, kit.nuts, 'nut')] : [])];
}
export const kitLinesTotal = (lines: KitLine[]) => roundKitMoney(lines.reduce((sum, line) => sum + line.subtotal, 0));

/** Kit lines store actual packed counts, so cart quantity changes must scale the whole group. */
export function scaleAccessoryKitConfig(config: any, multiplier: number) {
  if (!Array.isArray(config?.lines) || !config.lines.some((line: any) => line.kitRole)) return config;
  return { ...config,
    quantities: Object.fromEntries(Object.entries(config.quantities || {}).map(([key, value]) => [key, Number(value) * multiplier])),
    totalQuantity: Number(config.totalQuantity || 0) * multiplier,
    unitTotal: roundKitMoney(Number(config.unitTotal || 0) * multiplier),
    lines: config.lines.map((line: any) => ({ ...line, quantity: line.quantity * multiplier, subtotal: roundKitMoney(line.subtotal * multiplier) })),
  };
}

/** Repair the packing annotation on historical included-hardware rows without repricing orders. */
export function withIncludedAccessoryPacking(item: import('../types').CartItem, language: Language): import('../types').CartItem {
  const config = item.config as any;
  if (config?.type !== 'profile_accessory' || config.installationKit === false || !Array.isArray(config.lines)) return item;
  const additions: KitLine[] = [];
  for (const line of config.lines) {
    const defId = String(line.id || '').split('::')[0];
    if (!['1', '3'].includes(defId)) continue;
    const series = String(line.series || String(line.id).split('::')[1] || config.profileSize || '');
    const parentKey = `${defId}::${series}`;
    if (config.kitEnabled?.[parentKey] === false || config.lines.some((candidate: any) => candidate.kitParentKey === parentKey)) continue;
    additions.push(...buildAccessoryKitLines(defId, series, Number(line.quantity || 0), config.colorMode === 'colored' ? 'colored' : 'natural', language, parentKey));
  }
  return additions.length ? { ...item, config: { ...config, lines: [...config.lines, ...additions], totalQuantity: Number(config.totalQuantity || 0) + additions.reduce((n, line) => n + line.quantity, 0) } } : item;
}
