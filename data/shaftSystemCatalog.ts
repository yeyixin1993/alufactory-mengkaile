/**
 * Price-free coverage catalog for the Ø8 optical-shaft system.
 *
 * This file deliberately separates three different facts:
 * 1. a part has already been verified inside one approved template;
 * 2. a source-exact reference model exists but free placement is not calibrated;
 * 3. the market family is known, but no real model/specification has been recorded.
 *
 * A catalog row is therefore not automatically a SKU and never implies that it
 * may be ordered or manufactured. UI and scene code should only expose rows with
 * `canAddToScene: true`, and production should remain blocked unless the row's
 * own `productionEligible` flag (not its template scope) is true.
 */

export type ShaftSystemLocale = 'zh-CN' | 'en' | 'ja';

export type ShaftSystemLocalizedText = Readonly<Record<ShaftSystemLocale, string>>;

export type ShaftSystemGroupId =
  | 'shaft_rods'
  | 'support_bases'
  | 'fixed_clamps'
  | 'positioning_parts'
  | 'linear_motion'
  | 'coupling_accessories';

export type ShaftSystemReadiness =
  | 'verified_current_scope'
  | 'source_exact_pending_calibration'
  | 'coverage_gap';

export type ShaftSystemExposure =
  | 'parts_palette_verified'
  | 'parts_palette_design_draft'
  | 'coverage_gap_only';

/** Scene values are kept explicit so later UI work cannot invent adapters. */
export type ShaftSystemShelfSupportType =
  | 'linear_shaft'
  | 'shaft_support_sk8'
  | 'shaft_support_shf8'
  | 'shaft_support_cross_d8'
  | 'shaft_support_collar_d8';

export type ShaftSystemFixedReferenceId =
  | 'MODEL_REF_SK8_SUPPORT'
  | 'MODEL_REF_SHF8_SUPPORT'
  | 'MODEL_REF_CROSS_CLAMP_D8'
  | 'MODEL_REF_COLLAR_D8';

export type ShaftSystemDimensionsMm = readonly [number, number, number];

export interface ShaftSystemGroup {
  readonly id: ShaftSystemGroupId;
  readonly order: number;
  readonly names: ShaftSystemLocalizedText;
  readonly shortDescriptions: ShaftSystemLocalizedText;
}

export interface ShaftSystemSourceEvidence {
  readonly kind:
    | 'verified_template_and_user_validated_model'
    | 'user_validated_original_model'
    | 'coverage_gap_record';
  readonly source: string;
  readonly sourceRecordId: string | null;
  readonly sourceDefinition: string | null;
  readonly assetPath: string | null;
  readonly previewPath: string | null;
  readonly geometryFidelity:
    | 'parametric_axial_only'
    | 'source_exact_1_to_1'
    | 'unknown';
  readonly placementStatus:
    | 'verified_in_approved_template_only'
    | 'reference_only_pending_interference_calibration'
    | 'not_available';
}

export interface ShaftSystemTemplateScope {
  readonly id: 'approved_display_rack_3_0';
  readonly productionEligible: true;
  readonly notes: ShaftSystemLocalizedText;
}

interface ShaftSystemCatalogEntryBase {
  /** Stable data-layer id; it is not a commercial SKU. */
  readonly id: string;
  readonly groupId: ShaftSystemGroupId;
  readonly order: number;
  readonly names: ShaftSystemLocalizedText;
  readonly shortDescriptions: ShaftSystemLocalizedText;
  readonly observedLengthsMm: readonly number[];
  readonly sourceEvidence: ShaftSystemSourceEvidence;
  /** Manual insertion is not released for production in this catalog version. */
  readonly productionEligible: boolean;
  /** Separately records the narrow template scope that has already been verified. */
  readonly verifiedTemplateScope: ShaftSystemTemplateScope | null;
  readonly pendingEvidence: readonly string[];
}

export interface AddableShaftSystemCatalogEntry extends ShaftSystemCatalogEntryBase {
  /** Runtime catalog/extension identity; source evidence ids live in `fixedReferenceId`. */
  readonly catalogItemId: string;
  readonly readiness: Exclude<ShaftSystemReadiness, 'coverage_gap'>;
  readonly exposure: Exclude<ShaftSystemExposure, 'coverage_gap_only'>;
  readonly canAddToScene: true;
  readonly shelfSupportType: ShaftSystemShelfSupportType;
  readonly dimensionsMm: ShaftSystemDimensionsMm;
  readonly diameterMm: number;
  readonly fixedReferenceId: ShaftSystemFixedReferenceId | null;
  readonly dimensionPolicy: 'axial_length_only' | 'fixed_source_dimensions';
}

export interface ShaftSystemCoverageGapEntry extends ShaftSystemCatalogEntryBase {
  /** A coverage gap has no runtime catalog identity and is never a fabricated SKU. */
  readonly catalogItemId: null;
  readonly readiness: 'coverage_gap';
  readonly exposure: 'coverage_gap_only';
  readonly canAddToScene: false;
  readonly shelfSupportType: null;
  readonly dimensionsMm: null;
  readonly diameterMm: null;
  readonly fixedReferenceId: null;
  readonly dimensionPolicy: 'unknown';
  readonly productionEligible: false;
  readonly verifiedTemplateScope: null;
}

export type ShaftSystemCatalogEntry =
  | AddableShaftSystemCatalogEntry
  | ShaftSystemCoverageGapEntry;

const APPROVED_DISPLAY_RACK_SCOPE: ShaftSystemTemplateScope = {
  id: 'approved_display_rack_3_0',
  productionEligible: true,
  notes: {
    'zh-CN': '仅限已核验的 3.0 展示架模板组合、数量和安装位置；手动新增或移动后必须重新校验。',
    en: 'Only the verified 3.0 display-rack combination, quantities and placements; manual insertion or movement requires revalidation.',
    ja: '検証済み3.0展示ラックの組合せ・数量・配置に限定。手動追加または移動後は再検証が必要です。',
  },
};

export const SHAFT_SYSTEM_GROUPS: readonly ShaftSystemGroup[] = [
  {
    id: 'shaft_rods',
    order: 10,
    names: { 'zh-CN': '光轴杆件', en: 'Shaft rods', ja: 'リニアシャフト' },
    shortDescriptions: {
      'zh-CN': '按直径与长度选择；只允许沿轴向修改长度。',
      en: 'Choose by diameter and length; only axial length may change.',
      ja: '径と長さで選択し、軸方向の長さだけ変更できます。',
    },
  },
  {
    id: 'support_bases',
    order: 20,
    names: { 'zh-CN': '支撑底座', en: 'Support bases', ja: 'シャフト支持台' },
    shortDescriptions: {
      'zh-CN': '固定光轴端部或中间位置，安装方向与孔位必须复核。',
      en: 'Supports shaft ends or intermediate points; orientation and holes require validation.',
      ja: '軸端または中間を支持します。取付方向と穴位置の確認が必要です。',
    },
  },
  {
    id: 'fixed_clamps',
    order: 30,
    names: { 'zh-CN': '固定夹', en: 'Fixed clamps', ja: '固定クランプ' },
    shortDescriptions: {
      'zh-CN': '用于光轴之间或光轴与支柱之间定位；未校准件只可做方案草稿。',
      en: 'Locates shafts to shafts or supports; uncalibrated parts are design drafts only.',
      ja: '軸同士または支柱との位置決め用。未校正部品は設計案専用です。',
    },
  },
  {
    id: 'positioning_parts',
    order: 40,
    names: { 'zh-CN': '限位与定位', en: 'Stops and positioning', ja: 'ストッパー／位置決め' },
    shortDescriptions: {
      'zh-CN': '用于轴向止动与定位；紧固方式和工具净空必须核对。',
      en: 'Provides axial stopping and location; fastening and tool clearance must be checked.',
      ja: '軸方向の停止と位置決め用。締結方法と工具クリアランスの確認が必要です。',
    },
  },
  {
    id: 'linear_motion',
    order: 50,
    names: { 'zh-CN': '直线运动件', en: 'Linear motion parts', ja: '直線運動部品' },
    shortDescriptions: {
      'zh-CN': '直线轴承与带座轴承必须按真实型号、额定间隙和安装孔录入。',
      en: 'Linear bearings and housed bearings require real models, rated clearance and mounting-hole records.',
      ja: 'リニアベアリングとハウジング付軸受は、実機型番・定格すきま・取付穴情報が必要です。',
    },
  },
  {
    id: 'coupling_accessories',
    order: 60,
    names: { 'zh-CN': '联轴与安装辅件', en: 'Couplings and mounting aids', ja: 'カップリング／取付補助品' },
    shortDescriptions: {
      'zh-CN': '联轴器与安装辅件需按真实孔径、外形和紧固方式录入。',
      en: 'Couplings and mounting aids require verified bores, envelopes and fastening methods.',
      ja: 'カップリングと取付補助品は、実測穴径・外形・締結方法の登録が必要です。',
    },
  },
] as const;

export const SHAFT_SYSTEM_CATALOG: readonly ShaftSystemCatalogEntry[] = [
  {
    id: 'shaft.d8_g6',
    catalogItemId: 'mengkaile.accessory.linear_shaft_d8',
    groupId: 'shaft_rods',
    order: 10,
    names: { 'zh-CN': 'Ø8 直线光轴 g6', en: 'Ø8 linear shaft g6', ja: 'Ø8 リニアシャフト g6' },
    shortDescriptions: {
      'zh-CN': '3.0 展示架已验证；默认采用原模型中实测出现的 562 mm 长度。',
      en: 'Verified in the 3.0 display rack; defaults to the observed 562 mm source length.',
      ja: '3.0展示ラックで検証済み。原モデルで確認した562 mmを初期長さにします。',
    },
    readiness: 'verified_current_scope',
    exposure: 'parts_palette_verified',
    canAddToScene: true,
    shelfSupportType: 'linear_shaft',
    dimensionsMm: [8, 8, 562],
    diameterMm: 8,
    fixedReferenceId: null,
    dimensionPolicy: 'axial_length_only',
    observedLengthsMm: [48, 69, 209, 562],
    sourceEvidence: {
      kind: 'verified_template_and_user_validated_model',
      source: 'data/displayRackComponentCatalog.ts + shaft_reference_library.json',
      sourceRecordId: 'LINEAR_SHAFT_D8_G6',
      sourceDefinition: 'shaftSamples / approved 3.0 display-rack template',
      assetPath: null,
      previewPath: null,
      geometryFidelity: 'parametric_axial_only',
      placementStatus: 'verified_in_approved_template_only',
    },
    productionEligible: false,
    verifiedTemplateScope: APPROVED_DISPLAY_RACK_SCOPE,
    pendingEvidence: ['manual_placement_validation', 'manual_installation_clearance'],
  },
  {
    id: 'support.sk8',
    catalogItemId: 'mengkaile.accessory.shaft_support_sk8',
    groupId: 'support_bases',
    order: 10,
    names: { 'zh-CN': 'SK8 立式支撑底座', en: 'SK8 upright shaft support', ja: 'SK8 立形シャフト支持台' },
    shortDescriptions: {
      'zh-CN': 'Ø8 单轴支座，固定原模型尺寸；当前仅模板内安装位置已验证。',
      en: 'Ø8 single-shaft support with fixed source dimensions; only template placement is verified.',
      ja: '原モデル寸法固定のØ8単軸支持台。テンプレート内の配置のみ検証済みです。',
    },
    readiness: 'verified_current_scope',
    exposure: 'parts_palette_verified',
    canAddToScene: true,
    shelfSupportType: 'shaft_support_sk8',
    dimensionsMm: [42, 32.8, 14],
    diameterMm: 8,
    fixedReferenceId: 'MODEL_REF_SK8_SUPPORT',
    dimensionPolicy: 'fixed_source_dimensions',
    observedLengthsMm: [],
    sourceEvidence: {
      kind: 'verified_template_and_user_validated_model',
      source: 'data/accessoryModelAssets.ts + ALUFORMULA accessory source library',
      sourceRecordId: 'MODEL_REF_SK8_SUPPORT',
      sourceDefinition: '组#119',
      assetPath: 'assets/accessory-models/shaft-support-sk8/source/shaft-support-sk8.skp',
      previewPath: null,
      geometryFidelity: 'source_exact_1_to_1',
      placementStatus: 'verified_in_approved_template_only',
    },
    productionEligible: false,
    verifiedTemplateScope: APPROVED_DISPLAY_RACK_SCOPE,
    pendingEvidence: ['manual_placement_validation', 'manual_installation_clearance'],
  },
  {
    id: 'support.shf8',
    catalogItemId: 'mengkaile.accessory.shaft_support_shf8',
    groupId: 'support_bases',
    order: 20,
    names: { 'zh-CN': 'SHF8 卧式固定底座', en: 'SHF8 flange shaft support', ja: 'SHF8 フランジ形シャフト支持台' },
    shortDescriptions: {
      'zh-CN': 'Ø8 法兰式端部支座，固定原模型尺寸；当前仅模板内安装位置已验证。',
      en: 'Ø8 flanged end support with fixed source dimensions; only template placement is verified.',
      ja: '原モデル寸法固定のØ8フランジ形端部支持台。テンプレート内の配置のみ検証済みです。',
    },
    readiness: 'verified_current_scope',
    exposure: 'parts_palette_verified',
    canAddToScene: true,
    shelfSupportType: 'shaft_support_shf8',
    dimensionsMm: [43, 24, 10],
    diameterMm: 8,
    fixedReferenceId: 'MODEL_REF_SHF8_SUPPORT',
    dimensionPolicy: 'fixed_source_dimensions',
    observedLengthsMm: [],
    sourceEvidence: {
      kind: 'verified_template_and_user_validated_model',
      source: 'data/accessoryModelAssets.ts + ALUFORMULA accessory source library',
      sourceRecordId: 'MODEL_REF_SHF8_SUPPORT',
      sourceDefinition: '组#51',
      assetPath: 'assets/accessory-models/shaft-support-shf8/source/shaft-support-shf8.skp',
      previewPath: null,
      geometryFidelity: 'source_exact_1_to_1',
      placementStatus: 'verified_in_approved_template_only',
    },
    productionEligible: false,
    verifiedTemplateScope: APPROVED_DISPLAY_RACK_SCOPE,
    pendingEvidence: ['manual_placement_validation', 'manual_installation_clearance'],
  },
  {
    id: 'clamp.cross_d8',
    catalogItemId: 'mengkaile.accessory.shaft_cross_clamp_d8',
    groupId: 'fixed_clamps',
    order: 10,
    names: { 'zh-CN': 'Ø8 十字／直角交叉固定夹', en: 'Ø8 perpendicular cross clamp', ja: 'Ø8 直交クロスクランプ' },
    shortDescriptions: {
      'zh-CN': '原模型几何已核验；自由放置、干涉和安装净空尚未校准，只可用于方案草稿。',
      en: 'Source geometry is verified; free placement, interference and tool clearance remain uncalibrated, so it is design-only.',
      ja: '原モデル形状は検証済みですが、自由配置・干渉・工具クリアランスは未校正のため設計案専用です。',
    },
    readiness: 'source_exact_pending_calibration',
    exposure: 'parts_palette_design_draft',
    canAddToScene: true,
    shelfSupportType: 'shaft_support_cross_d8',
    dimensionsMm: [15, 41, 15],
    diameterMm: 8,
    fixedReferenceId: 'MODEL_REF_CROSS_CLAMP_D8',
    dimensionPolicy: 'fixed_source_dimensions',
    observedLengthsMm: [],
    sourceEvidence: {
      kind: 'user_validated_original_model',
      source: 'data/accessoryModelAssets.ts + ALUFORMULA accessory source library',
      sourceRecordId: 'MODEL_REF_CROSS_CLAMP_D8',
      sourceDefinition: '组件#139',
      assetPath: 'assets/accessory-models/shaft-cross-clamp-d8/source/shaft-cross-clamp-d8.skp',
      previewPath: 'assets/accessory-models/shaft-cross-clamp-d8/reference/shaft-cross-clamp-d8.png',
      geometryFidelity: 'source_exact_1_to_1',
      placementStatus: 'reference_only_pending_interference_calibration',
    },
    productionEligible: false,
    verifiedTemplateScope: null,
    pendingEvidence: ['interference_calibration', 'installation_clearance', 'fastener_record'],
  },
  {
    id: 'positioning.collar_d8',
    catalogItemId: 'mengkaile.accessory.shaft_collar_d8',
    groupId: 'positioning_parts',
    order: 10,
    names: { 'zh-CN': 'Ø8 开口止动夹环', en: 'Ø8 split shaft collar', ja: 'Ø8 スプリットシャフトカラー' },
    shortDescriptions: {
      'zh-CN': '外径 25.0 mm、精确包络 24.9895 × 24.9833 × 8 mm；自由放置与紧固净空待校准，只可用于方案草稿。',
      en: '25.0 mm OD with a source-exact 24.9895 × 24.9833 × 8 mm envelope; free placement and fastening clearance remain design-only pending calibration.',
      ja: '外径25.0 mm、原モデル包絡24.9895 × 24.9833 × 8 mm。自由配置と締結クリアランスは未校正のため設計案専用です。',
    },
    readiness: 'source_exact_pending_calibration',
    exposure: 'parts_palette_design_draft',
    canAddToScene: true,
    shelfSupportType: 'shaft_support_collar_d8',
    dimensionsMm: [24.9895, 24.9833, 8],
    diameterMm: 8,
    fixedReferenceId: 'MODEL_REF_COLLAR_D8',
    dimensionPolicy: 'fixed_source_dimensions',
    observedLengthsMm: [],
    sourceEvidence: {
      kind: 'user_validated_original_model',
      source: 'data/accessoryModelAssets.ts + ALUFORMULA accessory source library',
      sourceRecordId: 'MODEL_REF_COLLAR_D8',
      sourceDefinition: '组#160 / 组#31',
      assetPath: 'assets/accessory-models/shaft-collar-d8/source/shaft-collar-d8.skp',
      previewPath: 'assets/accessory-models/shaft-collar-d8/reference/shaft-collar-d8.png',
      geometryFidelity: 'source_exact_1_to_1',
      placementStatus: 'reference_only_pending_interference_calibration',
    },
    productionEligible: false,
    verifiedTemplateScope: null,
    pendingEvidence: ['interference_calibration', 'installation_clearance', 'fastener_record'],
  },
  {
    id: 'gap.parallel_double_hole_clamp',
    catalogItemId: null,
    groupId: 'fixed_clamps',
    order: 20,
    names: { 'zh-CN': '双孔平行固定夹', en: 'Twin-bore parallel clamp', ja: '二穴平行固定クランプ' },
    shortDescriptions: {
      'zh-CN': '已登记品类缺口；缺真实型号、尺寸、孔位与原模型，暂不可添加。',
      en: 'Coverage gap recorded; no verified model, dimensions or hole layout, so it cannot be inserted.',
      ja: '品目不足として登録済み。実機型番・寸法・穴位置・原モデル未確認のため追加できません。',
    },
    readiness: 'coverage_gap',
    exposure: 'coverage_gap_only',
    canAddToScene: false,
    shelfSupportType: null,
    dimensionsMm: null,
    diameterMm: null,
    fixedReferenceId: null,
    dimensionPolicy: 'unknown',
    observedLengthsMm: [],
    sourceEvidence: {
      kind: 'coverage_gap_record',
      source: 'user-requested shaft-system coverage review',
      sourceRecordId: null,
      sourceDefinition: null,
      assetPath: null,
      previewPath: null,
      geometryFidelity: 'unknown',
      placementStatus: 'not_available',
    },
    productionEligible: false,
    verifiedTemplateScope: null,
    pendingEvidence: ['manufacturer_model', 'exact_dimensions', 'hole_layout', 'source_geometry', 'installation_evidence'],
  },
  {
    id: 'gap.t_post_clamp',
    catalogItemId: null,
    groupId: 'fixed_clamps',
    order: 30,
    names: { 'zh-CN': 'T 型支柱固定夹', en: 'T-post clamp', ja: 'T形支柱固定クランプ' },
    shortDescriptions: {
      'zh-CN': '已登记品类缺口；缺真实型号、尺寸、孔位与原模型，暂不可添加。',
      en: 'Coverage gap recorded; no verified model, dimensions or hole layout, so it cannot be inserted.',
      ja: '品目不足として登録済み。実機型番・寸法・穴位置・原モデル未確認のため追加できません。',
    },
    readiness: 'coverage_gap',
    exposure: 'coverage_gap_only',
    canAddToScene: false,
    shelfSupportType: null,
    dimensionsMm: null,
    diameterMm: null,
    fixedReferenceId: null,
    dimensionPolicy: 'unknown',
    observedLengthsMm: [],
    sourceEvidence: {
      kind: 'coverage_gap_record',
      source: 'user-requested shaft-system coverage review',
      sourceRecordId: null,
      sourceDefinition: null,
      assetPath: null,
      previewPath: null,
      geometryFidelity: 'unknown',
      placementStatus: 'not_available',
    },
    productionEligible: false,
    verifiedTemplateScope: null,
    pendingEvidence: ['manufacturer_model', 'exact_dimensions', 'hole_layout', 'source_geometry', 'installation_evidence'],
  },
  {
    id: 'gap.l_right_angle_clamp',
    catalogItemId: null,
    groupId: 'fixed_clamps',
    order: 40,
    names: { 'zh-CN': 'L 型直角固定夹', en: 'L-angle shaft clamp', ja: 'L形直角固定クランプ' },
    shortDescriptions: {
      'zh-CN': '已登记品类缺口；缺真实型号、尺寸、孔位与原模型，暂不可添加。',
      en: 'Coverage gap recorded; no verified model, dimensions or hole layout, so it cannot be inserted.',
      ja: '品目不足として登録済み。実機型番・寸法・穴位置・原モデル未確認のため追加できません。',
    },
    readiness: 'coverage_gap',
    exposure: 'coverage_gap_only',
    canAddToScene: false,
    shelfSupportType: null,
    dimensionsMm: null,
    diameterMm: null,
    fixedReferenceId: null,
    dimensionPolicy: 'unknown',
    observedLengthsMm: [],
    sourceEvidence: {
      kind: 'coverage_gap_record',
      source: 'user-requested shaft-system coverage review',
      sourceRecordId: null,
      sourceDefinition: null,
      assetPath: null,
      previewPath: null,
      geometryFidelity: 'unknown',
      placementStatus: 'not_available',
    },
    productionEligible: false,
    verifiedTemplateScope: null,
    pendingEvidence: ['manufacturer_model', 'exact_dimensions', 'hole_layout', 'source_geometry', 'installation_evidence'],
  },
  {
    id: 'gap.linear_bearing',
    catalogItemId: null,
    groupId: 'linear_motion',
    order: 10,
    names: { 'zh-CN': '直线轴承（型号待录）', en: 'Linear bearing (model pending)', ja: 'リニアベアリング（型番未登録）' },
    shortDescriptions: {
      'zh-CN': '已登记泛类缺口；缺真实型号、游隙、负载和原模型，暂不可添加。',
      en: 'Generic coverage gap; no verified model, clearance, load data or source geometry, so it cannot be inserted.',
      ja: '汎用品目の不足として登録済み。実機型番・すきま・荷重・原モデル未確認のため追加できません。',
    },
    readiness: 'coverage_gap',
    exposure: 'coverage_gap_only',
    canAddToScene: false,
    shelfSupportType: null,
    dimensionsMm: null,
    diameterMm: null,
    fixedReferenceId: null,
    dimensionPolicy: 'unknown',
    observedLengthsMm: [],
    sourceEvidence: {
      kind: 'coverage_gap_record',
      source: 'user-requested shaft-system coverage review',
      sourceRecordId: null,
      sourceDefinition: null,
      assetPath: null,
      previewPath: null,
      geometryFidelity: 'unknown',
      placementStatus: 'not_available',
    },
    productionEligible: false,
    verifiedTemplateScope: null,
    pendingEvidence: ['manufacturer_model', 'exact_dimensions', 'clearance_rating', 'load_rating', 'source_geometry', 'installation_evidence'],
  },
  {
    id: 'gap.housed_linear_bearing',
    catalogItemId: null,
    groupId: 'linear_motion',
    order: 20,
    names: { 'zh-CN': '带座直线轴承（型号待录）', en: 'Housed linear bearing (model pending)', ja: 'ハウジング付リニアベアリング（型番未登録）' },
    shortDescriptions: {
      'zh-CN': '已登记泛类缺口；缺真实型号、安装孔、游隙和原模型，暂不可添加。',
      en: 'Generic coverage gap; no verified model, mounting holes, clearance or source geometry, so it cannot be inserted.',
      ja: '汎用品目の不足として登録済み。実機型番・取付穴・すきま・原モデル未確認のため追加できません。',
    },
    readiness: 'coverage_gap',
    exposure: 'coverage_gap_only',
    canAddToScene: false,
    shelfSupportType: null,
    dimensionsMm: null,
    diameterMm: null,
    fixedReferenceId: null,
    dimensionPolicy: 'unknown',
    observedLengthsMm: [],
    sourceEvidence: {
      kind: 'coverage_gap_record',
      source: 'user-requested shaft-system coverage review',
      sourceRecordId: null,
      sourceDefinition: null,
      assetPath: null,
      previewPath: null,
      geometryFidelity: 'unknown',
      placementStatus: 'not_available',
    },
    productionEligible: false,
    verifiedTemplateScope: null,
    pendingEvidence: ['manufacturer_model', 'exact_dimensions', 'mounting_hole_layout', 'clearance_rating', 'source_geometry', 'installation_evidence'],
  },
  {
    id: 'gap.shaft_coupling',
    catalogItemId: null,
    groupId: 'coupling_accessories',
    order: 10,
    names: { 'zh-CN': '联轴器（型号待录）', en: 'Shaft coupling (model pending)', ja: 'シャフトカップリング（型番未登録）' },
    shortDescriptions: {
      'zh-CN': '已登记泛类缺口；缺真实孔径组合、额定扭矩和原模型，暂不可添加。',
      en: 'Generic coverage gap; no verified bore pair, torque rating or source geometry, so it cannot be inserted.',
      ja: '汎用品目の不足として登録済み。実穴径組合せ・定格トルク・原モデル未確認のため追加できません。',
    },
    readiness: 'coverage_gap',
    exposure: 'coverage_gap_only',
    canAddToScene: false,
    shelfSupportType: null,
    dimensionsMm: null,
    diameterMm: null,
    fixedReferenceId: null,
    dimensionPolicy: 'unknown',
    observedLengthsMm: [],
    sourceEvidence: {
      kind: 'coverage_gap_record',
      source: 'user-requested shaft-system coverage review',
      sourceRecordId: null,
      sourceDefinition: null,
      assetPath: null,
      previewPath: null,
      geometryFidelity: 'unknown',
      placementStatus: 'not_available',
    },
    productionEligible: false,
    verifiedTemplateScope: null,
    pendingEvidence: ['manufacturer_model', 'bore_pair', 'torque_rating', 'exact_dimensions', 'source_geometry', 'installation_evidence'],
  },
  {
    id: 'gap.shaft_mounting_aids',
    catalogItemId: null,
    groupId: 'coupling_accessories',
    order: 20,
    names: { 'zh-CN': '光轴安装辅件（型号待录）', en: 'Shaft mounting aids (model pending)', ja: 'シャフト取付補助品（型番未登録）' },
    shortDescriptions: {
      'zh-CN': '已登记泛类缺口；待按具体辅件拆分并补真实型号、紧固方式和原模型。',
      en: 'Generic coverage gap; split into real accessory models with verified fastening and source geometry before use.',
      ja: '汎用品目の不足として登録済み。実用品目へ分解し、型番・締結方法・原モデルを確認してから使用します。',
    },
    readiness: 'coverage_gap',
    exposure: 'coverage_gap_only',
    canAddToScene: false,
    shelfSupportType: null,
    dimensionsMm: null,
    diameterMm: null,
    fixedReferenceId: null,
    dimensionPolicy: 'unknown',
    observedLengthsMm: [],
    sourceEvidence: {
      kind: 'coverage_gap_record',
      source: 'user-requested shaft-system coverage review',
      sourceRecordId: null,
      sourceDefinition: null,
      assetPath: null,
      previewPath: null,
      geometryFidelity: 'unknown',
      placementStatus: 'not_available',
    },
    productionEligible: false,
    verifiedTemplateScope: null,
    pendingEvidence: ['accessory_family_breakdown', 'manufacturer_model', 'fastening_method', 'exact_dimensions', 'source_geometry', 'installation_evidence'],
  },
] as const;

export const ADDABLE_SHAFT_SYSTEM_ENTRIES = SHAFT_SYSTEM_CATALOG.filter(
  (entry): entry is AddableShaftSystemCatalogEntry => entry.canAddToScene,
);

export const SHAFT_SYSTEM_COVERAGE_GAPS = SHAFT_SYSTEM_CATALOG.filter(
  (entry): entry is ShaftSystemCoverageGapEntry => entry.readiness === 'coverage_gap',
);

export const getShaftSystemEntryBySceneType = (
  shelfSupportType: string | null | undefined,
): AddableShaftSystemCatalogEntry | null => (
  ADDABLE_SHAFT_SYSTEM_ENTRIES.find((entry) => entry.shelfSupportType === shelfSupportType) || null
);

export const isShaftSystemShelfSupportType = (
  shelfSupportType: string | null | undefined,
): shelfSupportType is ShaftSystemShelfSupportType => Boolean(
  getShaftSystemEntryBySceneType(shelfSupportType),
);

export const getShaftSystemEntriesByGroup = (groupId: ShaftSystemGroupId) => (
  SHAFT_SYSTEM_CATALOG
    .filter((entry) => entry.groupId === groupId)
    .slice()
    .sort((left, right) => left.order - right.order)
);
