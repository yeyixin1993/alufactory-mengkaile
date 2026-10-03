import { DISPLAY_RACK_COMPONENT_CATALOG } from './displayRackComponentCatalog';
import type { Language } from '../types';
import { END_CAP_PRICES } from '../utils/accessoryPricing';
import { DESIGNER_SCREW_ACCESSORY_DEFINITIONS } from './designerScrewAccessoryCatalog';

export type AccessoryProfileSize = '1515' | '2020' | '3030' | '4040';
export type AccessoryColorMode = 'natural' | 'colored';

/**
 * Customer-facing colour choice is deliberately binary. "本色" (natural) is
 * the default; every other finish is billed through the "彩色" (coloured)
 * price tier. Bright silver and every anodised/powder colour live behind it.
 */
export const ACCESSORY_COLOR_MODES: AccessoryColorMode[] = ['natural', 'colored'];
export const DEFAULT_ACCESSORY_COLOR_MODE: AccessoryColorMode = 'natural';

/** Display order of the profile series used by the accessory catalog. */
export const ACCESSORY_SERIES_ORDER: AccessoryProfileSize[] = ['1515', '2020', '3030', '4040'];

/** Series marker for parts that fit every profile (8mm shafts and supports). */
export const ACCESSORY_UNIVERSAL_SERIES = 'universal' as const;
export type AccessoryRowSeries = AccessoryProfileSize | typeof ACCESSORY_UNIVERSAL_SERIES;

export const ACCESSORY_UNIVERSAL_LABEL: Record<Language, string> = {
  cn: '通用',
  en: 'All series',
  jp: '共通',
};

export interface AccessoryPrice {
  natural: number;
  colored: number;
  naturalBulk: number;
  coloredBulk: number;
}

export interface AccessoryDefinition {
  id: string;
  code: number;
  codeLabel?: Record<Language, string>;
  name: Record<Language, string>;
  note?: string;
  lengthPriced?: boolean;
  naturalOnly?: boolean;
  /**
   * Identity the designer needs so a generated part still resolves to a
   * catalog line, but which is not a customer-selectable purchase: the length
   * comes from the modelled geometry ("长度按设计取值"), so there is nothing
   * meaningful for a customer to add by hand. Internal identities stay in
   * `ACCESSORY_ROWS` (the pricing/identity surface) and are filtered out of
   * every customer-facing list.
   */
  designerInternalOnly?: boolean;
  imageKey?: string;
  prices: Partial<Record<AccessoryProfileSize, AccessoryPrice>>;
}

export const ACCESSORY_IMAGE = '/images/accessory/accessory_codes.jpg';
/** Separator between the definition id and the profile series inside a row key. */
export const ACCESSORY_ROW_KEY_SEPARATOR = '::';

/**
 * Stable identifier for one purchasable accessory line. The series is part of
 * the key so a single SKU can be ordered for several profile sizes in one cart.
 */
export const buildAccessoryRowKey = (defId: string, series: AccessoryRowSeries) => (
  `${defId}${ACCESSORY_ROW_KEY_SEPARATOR}${series}`
);
export const ACCESSORY_CODE_IMAGE_MAP: Record<string, string> = {
  '1': '/images/accessory/1.jpg',
  '2': '/images/accessory/2.jpg',
  '3': ACCESSORY_IMAGE,
  '5': '/images/accessory/5.jpg',
  '7': '/images/accessory/7L.jpg',
  '7L': '/images/accessory/7L.jpg',
  '7T': '/images/accessory/7T.jpg',
  '8': '/images/accessory/8.jpg',
  '9': '/images/accessory/9.jpg',
  '10': '/images/accessory/10.jpg',
  '10_1515_m4x6_cap': '/images/accessory/10_1515_m4x6_cap.jpg',
  '10_1515_m4x10_cs': '/images/accessory/10_1515_m4x10_cs.jpg',
  '10_1515_m4x12_cap': '/images/accessory/10_1515_m4x12_cap.jpg',
  '10_1515_m4_tnut': '/images/accessory/10_1515_m4_tnut.jpg',
  '10_2020_m5x14_cap': '/images/accessory/10_2020_m5x14_cap.jpg',
  '10_2020_m5x8_cap': '/images/accessory/10_2020_m5x8_cap.jpg',
  '10_2020_m6x20_cs': '/images/accessory/10_2020_m6x20_cs.jpg',
  '10_2020_m5_tnut': '/images/accessory/10_2020_m5_tnut.jpg',
  '10_3030_m6x18_cap': '/images/accessory/10_3030_m6x18_cap.jpg',
  '10_3030_m6x12_cap': '/images/accessory/10_3030_m6x12_cap.jpg',
  '10_3030_m8x20_cs': '/images/accessory/10_3030_m8x20_cs.jpg',
  '10_3030_m6_tnut': '/images/accessory/10_3030_m6_tnut.jpg',
};

// No.3 temporarily shares every No.7 price tier.
const NO3_AND_NO7_PRICES: AccessoryDefinition['prices'] = {
      '1515': { natural: 3, colored: 3.5, naturalBulk: 2.5, coloredBulk: 3 },
      '2020': { natural: 3, colored: 3.5, naturalBulk: 2.5, coloredBulk: 3 },
      '3030': { natural: 4.5, colored: 5, naturalBulk: 3.5, coloredBulk: 4 },
      '4040': { natural: 6, colored: 8, naturalBulk: 4.5, coloredBulk: 6 },
    };

const AUTHORED_ACCESSORY_DEFINITIONS: AccessoryDefinition[] = [
  ...(['SHAFT_8', 'SK8', 'SHF8'] as const).map((key, index): AccessoryDefinition => {
    const item = DISPLAY_RACK_COMPONENT_CATALOG[key];
    const price = item.unitPriceCny;
    return {
      id: item.id, code: 80 + index,
      codeLabel: { cn: key === 'SHAFT_8' ? 'Ø8' : key, en: key === 'SHAFT_8' ? 'Ø8' : key, jp: key === 'SHAFT_8' ? 'Ø8' : key },
      name: { cn: key === 'SHAFT_8' ? '8mm 光轴（g6）' : `${key} 光轴座（8mm）`, en: key === 'SHAFT_8' ? '8mm linear shaft (g6)' : `${key} shaft support (8mm)`, jp: key === 'SHAFT_8' ? '8mm シャフト（g6）' : `${key} シャフトサポート（8mm）` },
      naturalOnly: true, lengthPriced: key === 'SHAFT_8',
      prices: Object.fromEntries((['1515', '2020', '3030', '4040'] as const).map(size => [size, { natural: price, colored: price, naturalBulk: price, coloredBulk: price }])),
    };
  }),

  {
    id: '1',
    code: 1,
    name: { en: 'No.1 Corner Bracket + Screws', cn: '1号角码配螺丝', jp: '1番コーナーブラケット+ねじ' },
    prices: {
      '2020': { natural: 1, colored: 3, naturalBulk: 0.9, coloredBulk: 2.5 },
      '3030': { natural: 2, colored: 4, naturalBulk: 1.5, coloredBulk: 3.1 },
    },
  },
  {
    id: '2',
    code: 2,
    name: { en: 'No.2 Corner Bracket (Only)', cn: '2号角码 only', jp: '2番コーナーブラケットのみ' },
    prices: {
      '1515': { natural: 3, colored: 3.5, naturalBulk: 2.5, coloredBulk: 3 },
      '2020': { natural: 4, colored: 5, naturalBulk: 3.2, coloredBulk: 4 },
      '3030': { natural: 6, colored: 8, naturalBulk: 4.5, coloredBulk: 6 },
    },
  },
  {
    id: '3',
    code: 3,
    name: { en: 'No.3 Angle Bracket', cn: '3号角码', jp: '3番コーナーブラケット' },
    prices: NO3_AND_NO7_PRICES,
  },
  {
    id: '5',
    code: 5,
    name: { en: 'No.5 Corner Bracket + Set Screw', cn: '5号角码配顶丝', jp: '5番コーナーブラケット+止めねじ' },
    prices: {
      '2020': { natural: 1, colored: 3, naturalBulk: 0.9, coloredBulk: 2.5 },
      '3030': { natural: 1.5, colored: 3.5, naturalBulk: 1.3, coloredBulk: 3.1 },
    },
  },
  {
    id: '7L',
    code: 7,
    imageKey: '7L',
    name: { en: 'No.7 Corner Bracket (L Type)', cn: '7号角码 L型', jp: '7番コーナーブラケット L型' },
    prices: NO3_AND_NO7_PRICES,
  },
  {
    id: '7T',
    code: 7,
    imageKey: '7T',
    name: { en: 'No.7 Corner Bracket (T Type)', cn: '7号角码 T型', jp: '7番コーナーブラケット T型' },
    prices: NO3_AND_NO7_PRICES,
  },
  {
    id: '9',
    code: 9,
    name: { en: 'No.9 Tee Connector', cn: '9号三通', jp: '9番T字コネクタ' },
    prices: {
      '1515': { natural: 3, colored: 4, naturalBulk: 2.5, coloredBulk: 3 },
      '2020': { natural: 4, colored: 5, naturalBulk: 3.5, coloredBulk: 4 },
      '3030': { natural: 6, colored: 7, naturalBulk: 5.5, coloredBulk: 6 },
    },
  },
  {
    id: 'end_cap_2020',
    code: 0,
    codeLabel: { en: 'End cap', cn: '端盖', jp: 'エンドキャップ' },
    name: { en: '2020 Aluminum Profile End Cap', cn: '2020铝型材端盖', jp: '2020アルミプロファイル端キャップ' },
    prices: {
      '2020': {
        natural: END_CAP_PRICES['2020'].retail,
        colored: END_CAP_PRICES['2020'].retail,
        naturalBulk: END_CAP_PRICES['2020'].bulk,
        coloredBulk: END_CAP_PRICES['2020'].bulk,
      },
    },
  },
  {
    id: 'end_cap_3030',
    code: 0,
    codeLabel: { en: 'End cap', cn: '端盖', jp: 'エンドキャップ' },
    name: { en: '3030 Aluminum Profile End Cap', cn: '3030铝型材端盖', jp: '3030アルミプロファイル端キャップ' },
    prices: {
      '3030': {
        natural: END_CAP_PRICES['3030'].retail,
        colored: END_CAP_PRICES['3030'].retail,
        naturalBulk: END_CAP_PRICES['3030'].bulk,
        coloredBulk: END_CAP_PRICES['3030'].bulk,
      },
    },
  },
  {
    id: '10_1515_m4x6_cap',
    code: 10,
    name: { en: 'No.10 Screw · 304 M4*6 Socket Cap', cn: '10号螺丝 · 304 M4*6 圆柱头内六角', jp: '10番ねじ · 304 M4*6 六角穴付きボルト' },
    note: '1515：搭配7号配件',
    prices: {
      '1515': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_1515_m4x12_cap',
    code: 10,
    name: { en: 'No.10 Screw · 304 M4*12 Socket Cap', cn: '10号螺丝 · 304 M4*12 圆柱头内六角', jp: '10番ねじ · 304 M4*12 六角穴付きボルト' },
    note: '1515：搭配2号配件',
    prices: {
      '1515': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_1515_m4x10_cs',
    code: 10,
    name: { en: 'No.10 Screw · 304 M4*10 Countersunk', cn: '10号螺丝 · 304 M4*10 沉头内六角', jp: '10番ねじ · 304 M4*10 皿六角' },
    note: '1515：搭配9号配件',
    prices: {
      '1515': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_1515_m4_tnut',
    code: 10,
    name: { en: 'No.10 · 304 1515 M4 T Nut', cn: '10号配件 · 304 1515 M4 T型螺母', jp: '10番部品 · 304 1515 M4 Tナット' },
    note: '1515：T型螺母',
    prices: {
      '1515': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_2020_m5x14_cap',
    code: 10,
    name: { en: 'No.10 Screw · 304 M5*14 Socket Cap', cn: '10号螺丝 · 304 M5*14 圆柱头内六角', jp: '10番ねじ · 304 M5*14 六角穴付きボルト' },
    note: '2020：搭配2号配件',
    prices: {
      '2020': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_2020_m5x8_cap',
    code: 10,
    name: { en: 'No.10 Screw · 304 M5*8 Socket Cap', cn: '10号螺丝 · 304 M5*8 圆柱头内六角', jp: '10番ねじ · 304 M5*8 六角穴付きボルト' },
    note: '2020：搭配7号配件',
    prices: {
      '2020': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_2020_m6x20_cs',
    code: 10,
    name: { en: 'No.10 Screw · 304 M6*20 Countersunk', cn: '10号螺丝 · 304 M6*20 沉头内六角', jp: '10番ねじ · 304 M6*20 皿六角' },
    note: '2020：搭配9号配件',
    prices: {
      '2020': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_2020_m5_tnut',
    code: 10,
    name: { en: 'No.10 · 304 2020 M5 T Nut', cn: '10号配件 · 304 2020 M5 T型螺母', jp: '10番部品 · 304 2020 M5 Tナット' },
    note: '2020：T型螺母',
    prices: {
      '2020': { natural: 0.5, colored: 1, naturalBulk: 0.33, coloredBulk: 0.8 },
    },
  },
  {
    id: '10_3030_m6x18_cap',
    code: 10,
    name: { en: 'No.10 Screw · 304 M6*18 Socket Cap', cn: '10号螺丝 · 304 M6*18 圆柱头内六角', jp: '10番ねじ · 304 M6*18 六角穴付きボルト' },
    note: '3030：搭配2号配件',
    prices: {
      '3030': { natural: 0.75, colored: 1.25, naturalBulk: 0.5, coloredBulk: 1 },
    },
  },
  {
    id: '10_3030_m6x12_cap',
    code: 10,
    name: { en: 'No.10 Screw · 304 M6*12 Socket Cap', cn: '10号螺丝 · 304 M6*12 圆柱头内六角', jp: '10番ねじ · 304 M6*12 六角穴付きボルト' },
    note: '3030：搭配7号配件',
    prices: {
      '3030': { natural: 0.75, colored: 1.25, naturalBulk: 0.5, coloredBulk: 1 },
    },
  },
  {
    id: '10_3030_m8x20_cs',
    code: 10,
    name: { en: 'No.10 Screw · 304 M8*20 Countersunk', cn: '10号螺丝 · 304 M8*20 沉头内六角', jp: '10番ねじ · 304 M8*20 皿六角' },
    note: '3030：搭配9号配件',
    prices: {
      '3030': { natural: 0.75, colored: 1.25, naturalBulk: 0.5, coloredBulk: 1 },
    },
  },
  {
    id: '10_3030_m6_tnut',
    code: 10,
    name: { en: 'No.10 · 304 3030 M6 T Nut', cn: '10号配件 · 304 3030 M6 T型螺母', jp: '10番部品 · 304 3030 M6 Tナット' },
    note: '3030：T型螺母',
    prices: {
      '3030': { natural: 0.75, colored: 1.25, naturalBulk: 0.5, coloredBulk: 1 },
    },
  },
  // 暂不提供（图片有但当前无完整单价）
  // { code: 4, ... }
  // { code: 6, ... }
  // { code: 8, ... }
];

/**
 * The one accessory catalog. Hand-written rows come first so the familiar
 * No.1–No.9 lines keep their position; screw specifications the designer can
 * produce are appended.
 *
 * Screws are generated rather than authored because the designer derives them
 * from a machining rule, so a specification nobody had written down could
 * previously reach a customer at ¥0. Generated rows are skipped whenever an
 * authored row already covers the same identity.
 */
export const ACCESSORY_DEFINITIONS: AccessoryDefinition[] = [
  ...AUTHORED_ACCESSORY_DEFINITIONS,
  ...DESIGNER_SCREW_ACCESSORY_DEFINITIONS.filter((definition) => (
    !AUTHORED_ACCESSORY_DEFINITIONS.some((authored) => authored.id === definition.id)
  )),
];

/** Profile series that a definition is actually stocked/priced for. */
export const getAccessorySeriesOf = (def: AccessoryDefinition): AccessoryProfileSize[] => (
  ACCESSORY_SERIES_ORDER.filter((size) => Boolean(def.prices[size]))
);

/** One purchasable accessory line: a definition paired with a profile series. */
export interface AccessoryRow {
  key: string;
  defId: string;
  code: number;
  codeLabel?: Record<Language, string>;
  name: Record<Language, string>;
  series: AccessoryRowSeries;
  note?: string;
  lengthPriced?: boolean;
  naturalOnly?: boolean;
  /** Identity the designer resolves against, but not a customer-facing line. */
  designerInternalOnly?: boolean;
  imageKey?: string;
  price: AccessoryPrice;
}

/**
 * Flat, ready-to-render accessory list.
 *
 * Every definition is expanded once per compatible profile series so the
 * customer never has to pre-select 1515/2020/3030/4040 up front — the series
 * becomes a descriptive attribute of the row instead of a filter. Universal
 * parts (8mm shafts and supports) appear exactly once.
 */
export const ACCESSORY_ROWS: AccessoryRow[] = ACCESSORY_DEFINITIONS.flatMap((def): AccessoryRow[] => {
  const available = getAccessorySeriesOf(def);
  if (def.naturalOnly) {
    const source = available[0];
    if (!source) return [];
    return [{
      key: buildAccessoryRowKey(def.id, ACCESSORY_UNIVERSAL_SERIES),
      defId: def.id,
      code: def.code,
      codeLabel: def.codeLabel,
      name: def.name,
      series: ACCESSORY_UNIVERSAL_SERIES,
      note: def.note,
      lengthPriced: def.lengthPriced,
      naturalOnly: true,
      designerInternalOnly: def.designerInternalOnly,
      imageKey: def.imageKey,
      price: def.prices[source]!,
    }];
  }
  return available.map((series) => ({
    key: buildAccessoryRowKey(def.id, series),
    defId: def.id,
    code: def.code,
    codeLabel: def.codeLabel,
    name: def.name,
    series,
    note: def.note,
    lengthPriced: def.lengthPriced,
    designerInternalOnly: def.designerInternalOnly,
    imageKey: def.imageKey,
    price: def.prices[series]!,
  }));
});

/**
 * The accessory list a customer is allowed to pick from.
 *
 * `ACCESSORY_ROWS` stays complete on purpose — it is the identity and pricing
 * surface the designer resolves generated parts against. Anything flagged
 * `designerInternalOnly` (a screw whose length comes from the modelled
 * geometry, "长度按设计取值") has no meaningful hand-picked quantity, so every
 * customer-facing list renders this subset instead.
 */
export const CUSTOMER_ACCESSORY_ROWS: AccessoryRow[] = ACCESSORY_ROWS.filter(
  (row) => !row.designerInternalOnly,
);

/** Customer-facing accessory definitions, mirroring `CUSTOMER_ACCESSORY_ROWS`. */
export const CUSTOMER_ACCESSORY_DEFINITIONS: AccessoryDefinition[] = ACCESSORY_DEFINITIONS.filter(
  (definition) => !definition.designerInternalOnly,
);

/** Human label for the "适配型号" description of a row. */
export const getAccessoryRowSeriesLabel = (row: AccessoryRow, language: Language): string => (
  row.series === ACCESSORY_UNIVERSAL_SERIES
    ? ACCESSORY_UNIVERSAL_LABEL[language]
    : row.series
);

/**
 * Concatenated series label for a whole selection, e.g. `2020 / 3030`.
 * Used by the cart, factory sheet and PDF "适配型号" field.
 */
export const getAccessorySelectionSeriesLabel = (rows: AccessoryRow[], language: Language): string => {
  const labels: string[] = [];
  rows.forEach((row) => {
    const label = getAccessoryRowSeriesLabel(row, language);
    if (!labels.includes(label)) labels.push(label);
  });
  return labels.length ? labels.join(' / ') : '-';
};

/**
 * Migrates a legacy quantity map (keyed by definition id only) onto the new
 * per-series row keys. Legacy carts always carried a single profile size.
 */
export const migrateLegacyAccessoryQuantities = (
  quantities: Record<string, number> | undefined,
  legacyProfileSize: string | undefined,
): Record<string, number> => {
  const source = quantities || {};
  const fallbackSeries = ACCESSORY_SERIES_ORDER.includes(legacyProfileSize as AccessoryProfileSize)
    ? legacyProfileSize as AccessoryProfileSize
    : null;
  return Object.entries(source).reduce<Record<string, number>>((acc, [key, rawQuantity]) => {
    const quantity = Math.max(0, Number(rawQuantity) || 0);
    if (quantity <= 0) return acc;
    if (key.includes(ACCESSORY_ROW_KEY_SEPARATOR)) {
      acc[key] = quantity;
      return acc;
    }
    const definition = ACCESSORY_DEFINITIONS.find((def) => def.id === key);
    if (!definition) return acc;
    if (definition.naturalOnly) {
      acc[buildAccessoryRowKey(key, ACCESSORY_UNIVERSAL_SERIES)] = quantity;
      return acc;
    }
    const series = fallbackSeries && definition.prices[fallbackSeries]
      ? fallbackSeries
      : getAccessorySeriesOf(definition)[0];
    if (!series) return acc;
    acc[buildAccessoryRowKey(key, series)] = quantity;
    return acc;
  }, {});
};

