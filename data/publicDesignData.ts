import type { DrillHole, Language, ProfileFinish } from '../types';
import type { ImportedSourceMesh } from '../utils/importedSourceMesh';

/**
 * Price-free reference data shared by public design surfaces.
 *
 * Keep commerce values out of this module. Public geometry, naming and file
 * hand-off code may import it without pulling the commercial catalog into its
 * own static dependency graph.
 */

export interface PublicDesignColor {
  id: string;
  name: Record<Language, string>;
  maxLength: number;
}

export interface PublicDesignProfileVariant {
  id: string;
  name: string;
  /** Omitted when the source catalog does not publish wall thickness. */
  wallThickness?: number;
}

export const PUBLIC_PROFILE_COLORS: PublicDesignColor[] = [
  { id: 'natural', name: { en: 'Silver White', cn: '银白', jp: 'シルバーホワイト' }, maxLength: 3000 },
  { id: 'silver', name: { en: 'Bright Silver', cn: '亮银色', jp: 'ブライトシルバー' }, maxLength: 3000 },
  { id: 'red', name: { en: 'China Red', cn: '中国红', jp: 'チャイナレッド' }, maxLength: 3000 },
  { id: 'cola_red', name: { en: 'Cola Red', cn: '可乐红', jp: 'コーラレッド' }, maxLength: 3000 },
  { id: 'sapphire_blue', name: { en: 'Gem Blue', cn: '宝石蓝', jp: 'ジェムブルー' }, maxLength: 3000 },
  { id: 'purple', name: { en: 'Purple', cn: '紫色', jp: 'パープル' }, maxLength: 3000 },
  { id: 'sky_blue', name: { en: 'Light Cyan Blue', cn: '浅青蓝', jp: 'ライトシアンブルー' }, maxLength: 3000 },
  { id: 'green', name: { en: 'Pine Green', cn: '松绿', jp: '松緑' }, maxLength: 3000 },
  { id: 'willow_green', name: { en: 'Willow Green', cn: '柳绿', jp: '柳緑' }, maxLength: 3000 },
  { id: 'qingli_coffee', name: { en: 'Qingli Coffee', cn: '青骊咖', jp: '青驪コーヒー' }, maxLength: 3000 },
  { id: 'beige', name: { en: 'Beige', cn: '米白', jp: 'ベージュ' }, maxLength: 3000 },
  { id: 'indigo_blue', name: { en: 'Indigo Blue', cn: '黛蓝', jp: 'インディゴブルー' }, maxLength: 3000 },
  { id: 'cool_green', name: { en: 'Cool Cyan Green', cn: '冷青绿', jp: 'クールシアングリーン' }, maxLength: 3000 },
  { id: 'ink_green', name: { en: 'Ink Green', cn: '墨青绿', jp: 'インクグリーン' }, maxLength: 3000 },
  { id: 'apple_gold', name: { en: 'Apple Gold', cn: '苹果金', jp: 'アップルゴールド' }, maxLength: 3000 },
  { id: 'olive_brown', name: { en: 'Olive Brown', cn: '橄榄棕', jp: 'オリーブブラウン' }, maxLength: 3000 },
  { id: 'lime_gold', name: { en: 'Qingjin', cn: '青金', jp: '青金' }, maxLength: 3000 },
  { id: 'pink', name: { en: 'Lilac Pink', cn: '丁香粉', jp: 'ライラックピンク' }, maxLength: 3000 },
  { id: 'coffee', name: { en: 'Mocha', cn: '摩卡咖', jp: 'モカ' }, maxLength: 3000 },
  { id: 'black', name: { en: 'Midnight Black', cn: '暗夜黑', jp: 'ミッドナイトブラック' }, maxLength: 3000 },
  { id: 'british_grey', name: { en: 'Deep Space Gray', cn: '深空灰', jp: 'ディープスペースグレー' }, maxLength: 3000 },
];

export const PUBLIC_MARINE_BOARD_COLORS: PublicDesignColor[] = [
  { id: 'wood_natural', name: { en: 'Natural Wood', cn: '木材原色', jp: '木材原色' }, maxLength: 3000 },
  ...PUBLIC_PROFILE_COLORS.filter((color) => color.id !== 'natural'),
];

const MARINE_BOARD_ORIGINAL_NAME: Record<Language, string> = {
  en: 'Original',
  cn: '原色',
  jp: '原色',
};

export const getPublicMarineBoardOrderColorName = (colorId: string, language: Language) => {
  if (colorId === 'wood_natural' || colorId === 'natural') return MARINE_BOARD_ORIGINAL_NAME[language];
  return PUBLIC_MARINE_BOARD_COLORS.find((color) => color.id === colorId)?.name[language] || colorId;
};

export const PUBLIC_PROFILE_VARIANTS: PublicDesignProfileVariant[] = [
  { id: '1515', name: '1515', wallThickness: 1.0 },
  { id: '1515-N1', name: '1515 N1', wallThickness: 1.0 },
  { id: '1515-N2', name: '1515 N2', wallThickness: 1.0 },
  { id: '2020', name: '2020', wallThickness: 1.5 },
  { id: '2020-N1', name: '2020 N1', wallThickness: 1.5 },
  { id: '2020-N2', name: '2020 N2', wallThickness: 1.5 },
  { id: '2020-N2-OPP', name: '2020 N2 对边', wallThickness: 1.5 },
  { id: '2020-N3', name: '2020 N3', wallThickness: 1.5 },
  { id: '2020-N4-SQ', name: '2020 N4 方形', wallThickness: 1.5 },
  { id: '2020-N4-RD', name: '2020 N4 圆形', wallThickness: 1.5 },
  { id: '2020R', name: '2020R', wallThickness: 1.5 },
  { id: '2040', name: '2040', wallThickness: 1.5 },
  { id: '2040-N1-20', name: '2040 N1-20', wallThickness: 1.5 },
  { id: '2040-N1-40', name: '2040 N1-40', wallThickness: 1.5 },
  { id: '2047', name: '2047', wallThickness: 1.5 },
  { id: '2060', name: '2060', wallThickness: 1.5 },
  { id: '20100', name: '20100', wallThickness: 1.5 },
  { id: '3030', name: '3030', wallThickness: 1.8 },
  { id: '3030-N1', name: '3030 N1', wallThickness: 1.8 },
  { id: '3030-N2', name: '3030 N2', wallThickness: 1.8 },
  { id: '3030R', name: '3030R', wallThickness: 2.0 },
  { id: '3060', name: '3060', wallThickness: 1.8 },
  { id: '3060-N1-60', name: '3060 N1-60', wallThickness: 2.0 },
  { id: '4040', name: '4040', wallThickness: 2.0 },
  { id: '4080', name: '4080', wallThickness: 2.0 },
];

export type PublicParametricFurnitureSource =
  | 'calligraphy_cabinet'
  | 'wardrobe'
  | 'display_rack_3_0'
  | 'free_frame'
  | 'industrial_chair'
  | 'parametric_stool';

export type PublicParametricItemKind = 'profile' | 'marine_board' | 'shelf_support' | 'connector' | 'end_cap' | 'imported_component';

export type PublicParametricShelfSupportType =
  | 'diecast_cap_3030_t48'
  | 'diecast_cap_3030_t4'
  | 'end_mount_6060_m16'
  | 'leveling_foot_d100_m16_l100'
  | 'linear'
  | 'board_12mm'
  | 'linear_shaft'
  | 'shaft_support_sk8'
  | 'shaft_support_shf8'
  | 'shaft_support_cross_d8'
  | 'shaft_support_collar_d8'
  | 'linear_shaft_imported'
  | 'shaft_support_cross_imported'
  | 'shaft_support_collar_imported'
  | 'shaft_support_vertical_imported'
  | 'external_fixture_imported'
  | 'external_bom_only'
  | 'drawer_slide_pair'
  | 'drawer_generator_side_slide'
  | 'drawer_generator_under_slide';

export interface PublicParametricSceneItem {
  id: string;
  kind: PublicParametricItemKind;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  colorId: string;
  quantity: number;
  variantId?: string;
  length?: number;
  width?: number;
  height?: number;
  thickness?: number;
  holes?: DrillHole[];
  tappingLeft?: boolean;
  tappingRight?: boolean;
  finish?: ProfileFinish;
  shelfSupportType?: PublicParametricShelfSupportType;
  fixedReferenceId?:
    | 'MODEL_REF_SK8_SUPPORT'
    | 'MODEL_REF_SHF8_SUPPORT'
    | 'MODEL_REF_CROSS_CLAMP_D8'
    | 'MODEL_REF_COLLAR_D8';
  shaftDiameterMm?: number;
  accessoryProfileSize?: '2020' | '3030';
  autoGenerated?: boolean;
  lockedPosition?: boolean;
  attachedProfileIds?: string[];
  attachmentKey?: string;
  attachedEnd?: 'left' | 'right';
  autoAddedTapping?: boolean;
  remark?: string;
  sourceMesh?: ImportedSourceMesh;
}

export interface PublicParametricReferenceView {
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

export interface PublicParametricReferenceImage extends PublicParametricReferenceView {
  /** Other views of the same object. This image remains the 2D coordinate basis. */
  additionalImages?: PublicParametricReferenceView[];
  note?: string;
  calibration?: { widthMm?: number; heightMm?: number; depthMm?: number };
}

export interface PublicParametricTemplatePayload {
  schemaVersion: 1;
  source: PublicParametricFurnitureSource;
  createdAt: string;
  summary: Record<string, number | string>;
  items: PublicParametricSceneItem[];
  referenceImage?: PublicParametricReferenceImage;
  imageReconstruction?: unknown;
}

export const PUBLIC_DIY_TEMPLATE_STORAGE_PREFIX = 'mengkaile_diy_template_v1:';
export const MAX_FURNITURE_PROFILE_MM = 3000;
export const CALLIGRAPHY_BASKET_WIDTH_MM = 300;
export const CALLIGRAPHY_BASKET_DEPTH_MM = 420;
export const CALLIGRAPHY_BASKET_HEIGHT_MM = 100;
export const CALLIGRAPHY_LAYER_PITCH_MM = 130;
export const CALLIGRAPHY_OUTER_DEPTH_MM = 460;
export const CALLIGRAPHY_PROFILE_MM = 20;
export const CALLIGRAPHY_MAX_LENGTH_MM = 3000;
export const CALLIGRAPHY_MAX_HEIGHT_MM = 1600;
export const CALLIGRAPHY_TOP_BOARD_MAX_PIECE_MM = 2440;
export const WARDROBE_MIN_STORAGE_CLEARANCE_MM = 80;
export const WARDROBE_MAX_STORAGE_LAYERS = 20;
export const WARDROBE_MAX_COLUMNS = 9;
export const WARDROBE_MIN_COLUMN_PITCH_MM = 80;
export const WARDROBE_2040_INNER_GROOVE_OFFSET_MM = 10;

const clampInteger = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, Math.round(Number(value) || minimum)))
);

export const getWardrobeStorageLayerLimit = (heightInput: number) => {
  const heightMm = clampInteger(heightInput, 500, MAX_FURNITURE_PROFILE_MM);
  return Math.max(1, Math.min(
    WARDROBE_MAX_STORAGE_LAYERS,
    Math.floor((heightMm - 40) / WARDROBE_MIN_STORAGE_CLEARANCE_MM) - 1,
  ));
};

export const getWardrobeColumnLimit = (lengthInput: number) => {
  const lengthMm = clampInteger(lengthInput, 400, MAX_FURNITURE_PROFILE_MM);
  return Math.max(1, Math.min(WARDROBE_MAX_COLUMNS, Math.floor((lengthMm - 20) / WARDROBE_MIN_COLUMN_PITCH_MM)));
};

export const getWardrobeProfileCount = (columnsInput: number, storageLayersInput: number) => {
  const columns = clampInteger(columnsInput, 1, WARDROBE_MAX_COLUMNS);
  const storageLayers = Math.max(1, Math.round(Number(storageLayersInput) || 1));
  return 4 * columns + 8 + storageLayers * (3 * columns + 1);
};

export type PublicCalligraphyOpeningSide = 'short' | 'long';

export const getCalligraphyOpeningWidthMm = (openingSide: PublicCalligraphyOpeningSide) => (
  openingSide === 'long' ? CALLIGRAPHY_BASKET_DEPTH_MM : CALLIGRAPHY_BASKET_WIDTH_MM
);
export const getCalligraphyOuterDepthMm = (openingSide: PublicCalligraphyOpeningSide) => (
  (openingSide === 'long' ? CALLIGRAPHY_BASKET_WIDTH_MM : CALLIGRAPHY_BASKET_DEPTH_MM)
  + CALLIGRAPHY_PROFILE_MM * 2
);

export const getCalligraphyCabinetDimensions = (
  columnsInput: number,
  layersInput: number,
  openingSide: PublicCalligraphyOpeningSide = 'short',
) => {
  const openingWidthMm = getCalligraphyOpeningWidthMm(openingSide);
  const maxColumns = Math.floor((CALLIGRAPHY_MAX_LENGTH_MM - CALLIGRAPHY_PROFILE_MM) / (
    openingWidthMm + CALLIGRAPHY_PROFILE_MM
  ));
  const maxLayers = Math.floor((CALLIGRAPHY_MAX_HEIGHT_MM - CALLIGRAPHY_PROFILE_MM * 2
    - CALLIGRAPHY_LAYER_PITCH_MM / 2) / CALLIGRAPHY_LAYER_PITCH_MM);
  const columns = clampInteger(columnsInput, 1, maxColumns);
  const layers = clampInteger(layersInput, 1, maxLayers);
  return {
    columns,
    layers,
    openingSide,
    openingWidthMm,
    lengthMm: columns * openingWidthMm + (columns + 1) * CALLIGRAPHY_PROFILE_MM,
    heightMm: layers * CALLIGRAPHY_LAYER_PITCH_MM + CALLIGRAPHY_LAYER_PITCH_MM / 2 + CALLIGRAPHY_PROFILE_MM * 2,
    depthMm: getCalligraphyOuterDepthMm(openingSide),
  };
};

export const getCalligraphyGridForBounds = (
  lengthInput: number,
  heightInput: number,
  openingSide: PublicCalligraphyOpeningSide = 'short',
) => {
  const requestedLengthMm = clampInteger(
    lengthInput,
    getCalligraphyOpeningWidthMm(openingSide) + CALLIGRAPHY_PROFILE_MM * 2,
    CALLIGRAPHY_MAX_LENGTH_MM,
  );
  const requestedHeightMm = clampInteger(heightInput, 235, CALLIGRAPHY_MAX_HEIGHT_MM);
  const columns = Math.max(1, Math.floor((requestedLengthMm - CALLIGRAPHY_PROFILE_MM) / (
    getCalligraphyOpeningWidthMm(openingSide) + CALLIGRAPHY_PROFILE_MM
  )));
  const layers = Math.max(1, Math.floor((requestedHeightMm - CALLIGRAPHY_PROFILE_MM * 2
    - CALLIGRAPHY_LAYER_PITCH_MM / 2) / CALLIGRAPHY_LAYER_PITCH_MM));
  return {
    ...getCalligraphyCabinetDimensions(columns, layers, openingSide),
    requestedLengthMm,
    requestedHeightMm,
  };
};
