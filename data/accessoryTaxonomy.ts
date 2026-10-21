import type { Language } from '../types';

/**
 * 配件归档：把 41 个配件定义归到 5 个 domain / 13 个 family。
 *
 * 为什么单独一个文件而不是塞进 `accessoryCatalog.ts`：
 * 那个文件里是价格与身份真相（改错会算错钱），这里只是「怎么展示、怎么分类」。
 * 两者分开，分类调整不会碰到计价逻辑。
 *
 * 为什么按 family 而不是按编号（No.1–No.10）：
 * 原编号 `code` 已经混装——`code: 10` 下面既有螺丝又有 T 型螺母，`code: 0` 被两个端盖共用。
 * 买家也不会搜「10号配件」，他们搜「2020 角码」「M5 T型螺母」。
 * 编号保留为展示用别名，不再作为分类依据。
 */

export type AccessoryDomainId = 'fastener' | 'bracket' | 'cap' | 'motion' | 'panel';

export type AccessoryFamilyId =
  | 'screw-socket' | 'screw-countersunk' | 'screw-button' | 'screw-custom' | 't-nut'
  | 'bracket-inner' | 'bracket-std' | 'bracket-heavy' | 'tee-connector'
  | 'end-cap' | 'linear-shaft' | 'shaft-support'
  | 'pegboard-hook' | 'pegboard-rod' | 'pegboard-tray';

export interface AccessoryDomainMeta {
  id: AccessoryDomainId;
  cn: string;
  en: string;
  jp: string;
  /** 店铺一级分类顺序 */
  order: number;
  desc: string;
}

export const ACCESSORY_DOMAINS: AccessoryDomainMeta[] = [
  { id: 'fastener', cn: '紧固件', en: 'Fasteners', jp: '締結部品', order: 1,
    desc: '螺丝、T 型螺母——把型材和角码锁在一起' },
  { id: 'bracket', cn: '连接件', en: 'Brackets & Connectors', jp: 'ブラケット', order: 2,
    desc: '角码、三通——决定结构角度' },
  { id: 'cap', cn: '收口件', en: 'End Caps', jp: 'エンドキャップ', order: 3,
    desc: '端盖——盖住型材断面锐边' },
  { id: 'motion', cn: '传动导向', en: 'Motion & Guide', jp: 'モーション', order: 4,
    desc: '光轴、光轴座——做滑动与直线运动' },
  { id: 'panel', cn: '洞洞板系统', en: 'Pegboard', jp: 'ペグボード', order: 5,
    desc: '洞洞板与挂钩挂杆——墙面收纳' },
];

export interface AccessoryFamilyMeta {
  id: AccessoryFamilyId;
  domain: AccessoryDomainId;
  cn: string;
  en: string;
  /** 买家实际会搜的词，用于文案与站内搜索加权 */
  buyerSearchTerm: string;
}

export const ACCESSORY_FAMILIES: AccessoryFamilyMeta[] = [
  { id: 'screw-socket', domain: 'fastener', cn: '圆柱头内六角螺丝', en: 'Socket Head Cap Screw',
    buyerSearchTerm: '铝型材 内六角螺丝' },
  { id: 'screw-countersunk', domain: 'fastener', cn: '沉头内六角螺丝', en: 'Countersunk Screw',
    buyerSearchTerm: '铝型材 沉头螺丝' },
  { id: 'screw-button', domain: 'fastener', cn: '半圆头内六角螺丝', en: 'Button Head Screw',
    buyerSearchTerm: '铝型材 圆头螺丝' },
  { id: 'screw-custom', domain: 'fastener', cn: '定制长度螺丝', en: 'Custom Length Screw',
    buyerSearchTerm: '铝型材 定制长度螺丝' },
  { id: 't-nut', domain: 'fastener', cn: 'T 型螺母', en: 'T-Nut',
    buyerSearchTerm: '铝型材 T型螺母' },
  { id: 'bracket-inner', domain: 'bracket', cn: '内置角码', en: 'Inner Corner Bracket',
    buyerSearchTerm: '铝型材 内置角码' },
  { id: 'bracket-std', domain: 'bracket', cn: '直角角码', en: 'Corner Bracket',
    buyerSearchTerm: '铝型材 角码' },
  { id: 'bracket-heavy', domain: 'bracket', cn: '加强角码', en: 'Heavy Duty Bracket',
    buyerSearchTerm: '铝型材 加强角码' },
  { id: 'tee-connector', domain: 'bracket', cn: '三通连接件', en: 'Tee Connector',
    buyerSearchTerm: '铝型材 三通' },
  { id: 'end-cap', domain: 'cap', cn: '端盖', en: 'End Cap',
    buyerSearchTerm: '铝型材 端盖' },
  { id: 'linear-shaft', domain: 'motion', cn: '光轴', en: 'Linear Shaft',
    buyerSearchTerm: '8mm 光轴' },
  { id: 'shaft-support', domain: 'motion', cn: '光轴座', en: 'Shaft Support',
    buyerSearchTerm: 'SK8 光轴座' },
  { id: 'pegboard-hook', domain: 'panel', cn: '洞洞板挂钩', en: 'Pegboard Hook',
    buyerSearchTerm: '洞洞板 挂钩' },
  { id: 'pegboard-rod', domain: 'panel', cn: '洞洞板挂杆', en: 'Pegboard Rod',
    buyerSearchTerm: '洞洞板 挂杆' },
  { id: 'pegboard-tray', domain: 'panel', cn: '洞洞板托盘', en: 'Pegboard Tray',
    buyerSearchTerm: '洞洞板 托盘' },
];

export interface AccessoryTaxonomyEntry {
  domain: AccessoryDomainId;
  family: AccessoryFamilyId;
  /** 该族的短中文名，用于列表分组标题下的说明 */
  labelCn: string;
}

/**
 * 定义 id -> 归档。id 与 `accessoryCatalog.ts` 的 `AccessoryDefinition.id` 一一对应。
 * 新增配件时必须在这里登记，否则 `getAccessoryTaxonomy` 返回 null，列表会落到「未分类」。
 */
export const ACCESSORY_TAXONOMY: Record<string, AccessoryTaxonomyEntry> = {
  '7L': { domain: 'bracket', family: 'bracket-heavy', labelCn: '加强角码 L型' },
  '7T': { domain: 'bracket', family: 'bracket-heavy', labelCn: '加强角码 T型' },
  '1': { domain: 'bracket', family: 'bracket-inner', labelCn: '内置角码 含螺丝' },
  '5': { domain: 'bracket', family: 'bracket-inner', labelCn: '顶丝角码 含顶丝' },
  '2': { domain: 'bracket', family: 'bracket-std', labelCn: '直角角码 不含螺丝' },
  '3': { domain: 'bracket', family: 'bracket-std', labelCn: '直角角码 不含螺丝' },
  '9': { domain: 'bracket', family: 'tee-connector', labelCn: '三通连接件' },
  'end_cap_2020': { domain: 'cap', family: 'end-cap', labelCn: '端盖' },
  'end_cap_3030': { domain: 'cap', family: 'end-cap', labelCn: '端盖' },
  '10_1515_m4_btn': { domain: 'fastener', family: 'screw-button', labelCn: '半圆头内六角螺丝' },
  '10_2020_m6_btn': { domain: 'fastener', family: 'screw-button', labelCn: '半圆头内六角螺丝' },
  '10_2020_m6x20_btn': { domain: 'fastener', family: 'screw-button', labelCn: '半圆头内六角螺丝' },
  '10_3030_m8_btn': { domain: 'fastener', family: 'screw-button', labelCn: '半圆头内六角螺丝' },
  '10_3030_m8x20_btn': { domain: 'fastener', family: 'screw-button', labelCn: '半圆头内六角螺丝' },
  '10_4040_m8_btn': { domain: 'fastener', family: 'screw-button', labelCn: '半圆头内六角螺丝' },
  '10_1515_m4_cs': { domain: 'fastener', family: 'screw-countersunk', labelCn: '沉头内六角螺丝' },
  '10_1515_m4x10_cs': { domain: 'fastener', family: 'screw-countersunk', labelCn: '沉头内六角螺丝' },
  '10_2020_m6_cs': { domain: 'fastener', family: 'screw-countersunk', labelCn: '沉头内六角螺丝' },
  '10_2020_m6x20_cs': { domain: 'fastener', family: 'screw-countersunk', labelCn: '沉头内六角螺丝' },
  '10_2020_m6x8_cs': { domain: 'fastener', family: 'screw-countersunk', labelCn: '沉头内六角螺丝' },
  '10_3030_m8_cs': { domain: 'fastener', family: 'screw-countersunk', labelCn: '沉头内六角螺丝' },
  '10_3030_m8x20_cs': { domain: 'fastener', family: 'screw-countersunk', labelCn: '沉头内六角螺丝' },
  '10_4040_m8_cs': { domain: 'fastener', family: 'screw-countersunk', labelCn: '沉头内六角螺丝' },
  '10_1515_m4_cap': { domain: 'fastener', family: 'screw-socket', labelCn: '圆柱头内六角螺丝' },
  '10_1515_m4x12_cap': { domain: 'fastener', family: 'screw-socket', labelCn: '圆柱头内六角螺丝' },
  '10_1515_m4x6_cap': { domain: 'fastener', family: 'screw-socket', labelCn: '圆柱头内六角螺丝' },
  '10_2020_m5x14_cap': { domain: 'fastener', family: 'screw-socket', labelCn: '圆柱头内六角螺丝' },
  '10_2020_m5x8_cap': { domain: 'fastener', family: 'screw-socket', labelCn: '圆柱头内六角螺丝' },
  '10_2020_m6_cap': { domain: 'fastener', family: 'screw-socket', labelCn: '圆柱头内六角螺丝' },
  '10_2020_m6x30_cap': { domain: 'fastener', family: 'screw-socket', labelCn: '圆柱头内六角螺丝' },
  '10_3030_m6x12_cap': { domain: 'fastener', family: 'screw-socket', labelCn: '圆柱头内六角螺丝' },
  '10_3030_m6x18_cap': { domain: 'fastener', family: 'screw-socket', labelCn: '圆柱头内六角螺丝' },
  '10_3030_m8_cap': { domain: 'fastener', family: 'screw-socket', labelCn: '圆柱头内六角螺丝' },
  '10_3030_m8x45_cap': { domain: 'fastener', family: 'screw-socket', labelCn: '圆柱头内六角螺丝' },
  '10_4040_m8_cap': { domain: 'fastener', family: 'screw-socket', labelCn: '圆柱头内六角螺丝' },
  '10_1515_m4_tnut': { domain: 'fastener', family: 't-nut', labelCn: 'T型螺母' },
  '10_2020_m5_tnut': { domain: 'fastener', family: 't-nut', labelCn: 'T型螺母' },
  '10_3030_m6_tnut': { domain: 'fastener', family: 't-nut', labelCn: 'T型螺母' },
  'LINEAR_SHAFT_D8_G6': { domain: 'motion', family: 'linear-shaft', labelCn: '8mm光轴' },
  'MODEL_REF_SHF8_SUPPORT': { domain: 'motion', family: 'shaft-support', labelCn: 'SHF8光轴座' },
  'MODEL_REF_SK8_SUPPORT': { domain: 'motion', family: 'shaft-support', labelCn: 'SK8光轴座' },
};

export const getAccessoryTaxonomy = (defId: string): AccessoryTaxonomyEntry | null =>
  ACCESSORY_TAXONOMY[defId] ?? null;

export const getAccessoryFamily = (defId: string): AccessoryFamilyMeta | null => {
  const entry = getAccessoryTaxonomy(defId);
  if (!entry) return null;
  return ACCESSORY_FAMILIES.find((f) => f.id === entry.family) ?? null;
};

export const getAccessoryDomain = (defId: string): AccessoryDomainMeta | null => {
  const entry = getAccessoryTaxonomy(defId);
  if (!entry) return null;
  return ACCESSORY_DOMAINS.find((d) => d.id === entry.domain) ?? null;
};

export interface AccessoryGroup<T> {
  domain: AccessoryDomainMeta;
  families: { family: AccessoryFamilyMeta; rows: T[] }[];
  total: number;
}

/**
 * 把一维配件行按 domain -> family 分组，供列表分组渲染。
 * 未登记的行归到 `uncategorized`（排在最后），便于一眼看出漏登记的配件。
 */
export const groupAccessoryRowsByDomain = <T extends { defId: string }>(rows: T[]): AccessoryGroup<T>[] => {
  const byDomain = new Map<AccessoryDomainId, Map<AccessoryFamilyId, T[]>>();
  const orphans: T[] = [];

  rows.forEach((row) => {
    const entry = getAccessoryTaxonomy(row.defId);
    if (!entry) {
      orphans.push(row);
      return;
    }
    if (!byDomain.has(entry.domain)) byDomain.set(entry.domain, new Map());
    const famMap = byDomain.get(entry.domain)!;
    if (!famMap.has(entry.family)) famMap.set(entry.family, []);
    famMap.get(entry.family)!.push(row);
  });

  const groups: AccessoryGroup<T>[] = ACCESSORY_DOMAINS
    .filter((d) => byDomain.has(d.id))
    .sort((a, b) => a.order - b.order)
    .map((domain) => {
      const famMap = byDomain.get(domain.id)!;
      const families = ACCESSORY_FAMILIES
        .filter((f) => famMap.has(f.id))
        .map((family) => ({ family, rows: famMap.get(family.id)! }));
      return { domain, families, total: families.reduce((n, f) => n + f.rows.length, 0) };
    });

  if (orphans.length) {
    groups.push({
      domain: { id: 'panel', cn: '未分类', en: 'Uncategorised', jp: '未分類', order: 99,
        desc: '未在 ACCESSORY_TAXONOMY 登记的配件' },
      families: [],
      total: orphans.length,
    });
  }
  return groups;
};

/** 给搜索框用：族名 + 买家搜索词 + 别名，命中任一项即算匹配 */
export const getAccessoryFamilySearchText = (defId: string, language: Language): string => {
  const fam = getAccessoryFamily(defId);
  if (!fam) return '';
  const name = language === 'en' ? fam.en : fam.cn;
  return `${name} ${fam.cn} ${fam.buyerSearchTerm}`.toLowerCase();
};
