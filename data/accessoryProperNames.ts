import type { Language } from '../types';

// Customer-supplied 配件学名对照表.html; naming only, never SKU/geometry mapping.
const names: Record<string, Record<Language, string>> = {
  '1': { cn: '外置角码', en: 'External corner bracket', jp: '外付けコーナーブラケット' },
  '2': { cn: '挤压角码', en: 'Extruded corner bracket', jp: '押出コーナーブラケット' },
  '3': { cn: '角铝', en: 'Aluminum angle', jp: 'アルミアングル' },
  '5': { cn: '内置角槽连接件', en: 'Internal corner slot connector', jp: '内蔵コーナー溝コネクター' },
  '7L': { cn: 'L型连接片', en: 'L-shaped joining plate', jp: 'L型接続プレート' },
  '7T': { cn: 'T型连接片', en: 'T-shaped joining plate', jp: 'T型接続プレート' },
  '9': { cn: '三通连接件', en: 'Three-way connector', jp: '三方向コネクター' },
};
export function accessoryProperName(defId: string, language: Language): string {
  if (defId.endsWith('_tnut')) return { cn: '船型螺母', en: 'T-slot nut', jp: 'Tスロットナット' }[language];
  return names[defId]?.[language] || '';
}
