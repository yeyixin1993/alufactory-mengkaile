export interface FixedDisplayRackComponent {
  id: string;
  category: 'linear_shaft' | 'shaft_support' | 'drawer_hardware';
  name: string;
  model: string;
  dimensionsMm?: readonly [number, number, number];
  diameterMm?: number;
  source: string;
  geometryStatus: 'source_exact_1_to_1' | 'parametric_by_length';
  scalePolicy: 'no_stretch' | 'length_only';
  unitPriceStatus: 'confirmed';
  unitPriceCny?: number;
  priceUnit: 'meter' | 'piece' | 'pair';
  pairConfiguration?: 'left_and_right';
  sideClearanceMm?: number;
  railHeightMm?: number;
  lengthOptions?: readonly {
    lengthMm: number;
    unitPriceCny: number;
  }[];
}

// Fixed component records used by the approved 3.0 display-rack product.
// Dimensions and identifiers mirror the verified SketchUp component library.
// Prices were confirmed by the site owner. All listed slide lengths remain
// available to the configurator, BOM, cart and PDF flow.
export const DISPLAY_RACK_COMPONENT_CATALOG = {
  SHAFT_8: {
    id: 'LINEAR_SHAFT_D8_G6',
    category: 'linear_shaft',
    name: 'Ø8直线光轴 g6',
    model: 'Ø8',
    diameterMm: 8,
    source: '叶总展示柜2026.9.1。3.0.skp',
    geometryStatus: 'parametric_by_length',
    scalePolicy: 'length_only',
    unitPriceStatus: 'confirmed',
    unitPriceCny: 10,
    priceUnit: 'meter',
  },
  SK8: {
    id: 'MODEL_REF_SK8_SUPPORT',
    category: 'shaft_support',
    name: 'SK8单轴支座',
    model: 'SK8',
    dimensionsMm: [42, 32.8, 14],
    diameterMm: 8,
    source: '固定数据库／原模型组#119',
    geometryStatus: 'source_exact_1_to_1',
    scalePolicy: 'no_stretch',
    unitPriceStatus: 'confirmed',
    unitPriceCny: 2,
    priceUnit: 'piece',
  },
  SHF8: {
    id: 'MODEL_REF_SHF8_SUPPORT',
    category: 'shaft_support',
    name: 'SHF8法兰式光轴支座',
    model: 'SHF8',
    dimensionsMm: [43, 24, 10],
    diameterMm: 8,
    source: '固定数据库／原模型组#51',
    geometryStatus: 'source_exact_1_to_1',
    scalePolicy: 'no_stretch',
    unitPriceStatus: 'confirmed',
    unitPriceCny: 2,
    priceUnit: 'piece',
  },
  DRAWER_SLIDE_PAIR: {
    id: 'DRAWER_SLIDE_PAIR_13MM',
    category: 'drawer_hardware',
    name: '三节滚珠抽屉滑轨（一套左右）',
    model: '抽屉滑轨套装',
    source: '插件既有抽屉规则：单侧安装间隙13mm；长度按柜深匹配标准规格',
    geometryStatus: 'parametric_by_length',
    scalePolicy: 'length_only',
    unitPriceStatus: 'confirmed',
    priceUnit: 'pair',
    pairConfiguration: 'left_and_right',
    sideClearanceMm: 13,
    railHeightMm: 45,
    lengthOptions: [
      { lengthMm: 700, unitPriceCny: 42 },
      { lengthMm: 650, unitPriceCny: 40 },
      { lengthMm: 600, unitPriceCny: 38 },
      { lengthMm: 550, unitPriceCny: 36 },
      { lengthMm: 500, unitPriceCny: 34 },
      { lengthMm: 450, unitPriceCny: 32 },
      { lengthMm: 400, unitPriceCny: 30 },
      { lengthMm: 350, unitPriceCny: 28 },
      { lengthMm: 300, unitPriceCny: 26 },
      { lengthMm: 250, unitPriceCny: 24 },
    ],
  },
} as const satisfies Record<string, FixedDisplayRackComponent>;
