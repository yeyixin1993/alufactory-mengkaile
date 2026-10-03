import { DISPLAY_RACK_COMPONENT_CATALOG } from './displayRackComponentCatalog';
import { getDesignerExtensionRegistrySnapshot } from './designerExtensionRegistry';
import { PUBLIC_PROFILE_VARIANTS } from './publicDesignData';
import { SHAFT_SYSTEM_COVERAGE_GAPS } from './shaftSystemCatalog';
import { REFERENCE_HARDWARE_CATALOG } from './referenceHardwareCatalog';
import { PLUGIN_ACCESSORY_SOURCE_CATALOG } from './pluginAccessorySourceCatalog';
import { PLUGIN_PROFILE_CATALOG } from './pluginProfileCatalog';

/**
 * Price-free inventory of every model family the designer currently knows about.
 *
 * This is deliberately a coverage/readiness catalog, not a sales catalog. A row
 * may exist here while its renderer, manufacturing validator or installation
 * evidence is still pending. Keeping those states explicit prevents a backend
 * stock record or a SketchUp reference asset from silently becoming a usable SKU.
 */

export type DesignerModelCategoryId =
  | 'profile'
  | 'panel'
  | 'profile_connector'
  | 'fastener'
  | 'linear_shaft'
  | 'shaft_support_clamp'
  | 'drawer_slide'
  | 'foot_caster'
  | 'end_cap'
  | 'other_accessory';

export type DesignerModelReadiness =
  | 'integrated_current_scope'
  | 'legacy_designer_pending_registry'
  | 'catalog_record_pending_model'
  | 'reference_asset_pending_calibration';

export type DesignerModelUiExposure =
  | 'profile_picker'
  | 'parts_palette'
  | 'template_or_import_only'
  | 'automatic_rule_only'
  | 'not_exposed';

export interface DesignerModelCategory {
  readonly id: DesignerModelCategoryId;
  readonly names: Readonly<{ 'zh-CN': string; en: string; ja?: string }>;
  /** A category can be covered even while its first verified item is pending. */
  readonly emptyState: string | null;
}

export interface DesignerModelCatalogEntry {
  readonly id: string;
  readonly categoryId: DesignerModelCategoryId;
  readonly names: Readonly<{ 'zh-CN': string; en: string; ja?: string }>;
  readonly catalogSource: string;
  readonly sourceRecordId: string;
  readonly compatibleProfileIds: readonly string[];
  readonly readiness: DesignerModelReadiness;
  readonly uiExposure: DesignerModelUiExposure;
  readonly extensionId: string | null;
  readonly previewAssetStatus: 'available' | 'pending' | 'not_applicable';
  /** Missing work is explicit and never treated as an inferred specification. */
  readonly pendingEvidence: readonly string[];
}

export interface DesignerModelCatalogSnapshot {
  readonly categories: readonly DesignerModelCategory[];
  readonly entries: readonly DesignerModelCatalogEntry[];
  readonly counts: Readonly<{
    integrated: number;
    pending: number;
    referenceOnly: number;
  }>;
}

export const DESIGNER_MODEL_CATEGORIES: readonly DesignerModelCategory[] = [
  { id: 'profile', names: { 'zh-CN': '铝型材', en: 'Aluminum profiles', ja: 'アルミフレーム' }, emptyState: null },
  { id: 'panel', names: { 'zh-CN': '板材／面板', en: 'Boards and panels', ja: 'ボード／パネル' }, emptyState: null },
  { id: 'profile_connector', names: { 'zh-CN': '型材连接件', en: 'Profile connectors', ja: 'フレーム接続金具' }, emptyState: null },
  { id: 'fastener', names: { 'zh-CN': '螺丝与紧固件', en: 'Screws and fasteners', ja: 'ねじ／締結部品' }, emptyState: null },
  { id: 'linear_shaft', names: { 'zh-CN': '直线光轴', en: 'Linear shafts', ja: 'リニアシャフト' }, emptyState: null },
  { id: 'shaft_support_clamp', names: { 'zh-CN': '光轴支座、夹具与运动件', en: 'Shaft supports, clamps and motion parts', ja: 'シャフト支持・クランプ・運動部品' }, emptyState: null },
  { id: 'drawer_slide', names: { 'zh-CN': '抽屉滑轨', en: 'Drawer slides', ja: '引き出しレール' }, emptyState: null },
  {
    id: 'foot_caster',
    names: { 'zh-CN': '地脚与脚轮', en: 'Feet and casters', ja: 'アジャスター／キャスター' },
    emptyState: '含参考图重建的地脚与安装块；实物型号、安装和承载资料仍待核验。',
  },
  { id: 'end_cap', names: { 'zh-CN': '型材端盖', en: 'Profile end caps', ja: 'フレームエンドキャップ' }, emptyState: null },
  {
    id: 'other_accessory',
    names: { 'zh-CN': '其他配件（待分类）', en: 'Other accessories (quarantine)', ja: 'その他部品（要分類）' },
    emptyState: '仅作待整理区；未分类构件不得获得生产放行。',
  },
] as const;

const PROFILE_PREVIEW_ASSETS = new Set([
  '1515', '1515-N1', '1515-N2',
  '2020', '2020-N1', '2020-N2', '2020-N2-OPP', '2020-N3', '2020-N4-SQ', '2020-N4-RD', '2020R',
  '2040', '2040-N1-20', '2040-N1-40', '2047', '2060', '20100',
  '3030', '3030-N1', '3030-N2', '3030R', '3060', '4040',
]);

type AccessoryCatalogRecord = Readonly<{
  id: string;
  code: string;
  name: string;
  categoryId: 'profile_connector' | 'fastener' | 'end_cap';
  compatibleProfileIds: readonly string[];
  sceneKind: string | null;
  extensionId: string | null;
}>;

/** Exact price-free mirror of alufactory-backend/app/accessory_inventory.py. */
export const COMMON_ACCESSORY_CATALOG: readonly AccessoryCatalogRecord[] = [
  { id: '1', code: '1', name: '压铸直角角件（配螺丝）', categoryId: 'profile_connector', compatibleProfileIds: ['2020', '3030'], sceneKind: 'connector', extensionId: 'mengkaile.accessory.corner_bracket_no1' },
  { id: '2', code: '2', name: '加强型挤压角座', categoryId: 'profile_connector', compatibleProfileIds: ['1515', '2020', '3030'], sceneKind: 'extruded_connector', extensionId: null },
  { id: '5', code: '5', name: '隐藏式内置连接件（配顶丝）', categoryId: 'profile_connector', compatibleProfileIds: ['2020', '3030'], sceneKind: 'hidden_connector', extensionId: 'mengkaile.accessory.hidden_connector_no5' },
  { id: '7L', code: '7L', name: 'L型连接板', categoryId: 'profile_connector', compatibleProfileIds: ['1515', '2020', '3030', '4040'], sceneKind: 'l_connector', extensionId: null },
  { id: '7T', code: '7T', name: 'T型连接板', categoryId: 'profile_connector', compatibleProfileIds: ['1515', '2020', '3030', '4040'], sceneKind: 't_connector', extensionId: null },
  { id: '9', code: '9', name: '三维角连接件', categoryId: 'profile_connector', compatibleProfileIds: ['1515', '2020', '3030'], sceneKind: 'tee_connector', extensionId: null },
  { id: 'end_cap_2020', code: '端盖', name: '2020铝型材端盖', categoryId: 'end_cap', compatibleProfileIds: ['2020'], sceneKind: 'end_cap', extensionId: null },
  { id: 'end_cap_3030', code: '端盖', name: '3030铝型材端盖', categoryId: 'end_cap', compatibleProfileIds: ['3030'], sceneKind: 'end_cap', extensionId: null },
  { id: '10_1515_m4x6_cap', code: '10', name: '304 M4*6 圆柱头内六角', categoryId: 'fastener', compatibleProfileIds: ['1515'], sceneKind: null, extensionId: null },
  { id: '10_1515_m4x12_cap', code: '10', name: '304 M4*12 圆柱头内六角', categoryId: 'fastener', compatibleProfileIds: ['1515'], sceneKind: null, extensionId: null },
  { id: '10_1515_m4x10_cs', code: '10', name: '304 M4*10 沉头内六角', categoryId: 'fastener', compatibleProfileIds: ['1515'], sceneKind: null, extensionId: null },
  { id: '10_1515_m4_tnut', code: '10', name: '304 1515 M4 T型螺母', categoryId: 'fastener', compatibleProfileIds: ['1515'], sceneKind: null, extensionId: null },
  { id: '10_2020_m5x14_cap', code: '10', name: '304 M5*14 圆柱头内六角', categoryId: 'fastener', compatibleProfileIds: ['2020'], sceneKind: null, extensionId: null },
  { id: '10_2020_m5x8_cap', code: '10', name: '304 M5*8 圆柱头内六角', categoryId: 'fastener', compatibleProfileIds: ['2020'], sceneKind: null, extensionId: null },
  { id: '10_2020_m6x20_cs', code: '10', name: '304 M6*20 沉头内六角', categoryId: 'fastener', compatibleProfileIds: ['2020'], sceneKind: null, extensionId: null },
  { id: '10_2020_m5_tnut', code: '10', name: '304 2020 M5 T型螺母', categoryId: 'fastener', compatibleProfileIds: ['2020'], sceneKind: null, extensionId: null },
  { id: '10_3030_m6x18_cap', code: '10', name: '304 M6*18 圆柱头内六角', categoryId: 'fastener', compatibleProfileIds: ['3030'], sceneKind: null, extensionId: null },
  { id: '10_3030_m6x12_cap', code: '10', name: '304 M6*12 圆柱头内六角', categoryId: 'fastener', compatibleProfileIds: ['3030'], sceneKind: null, extensionId: null },
  { id: '10_3030_m8x20_cs', code: '10', name: '304 M8*20 沉头内六角', categoryId: 'fastener', compatibleProfileIds: ['3030'], sceneKind: null, extensionId: null },
  { id: '10_3030_m6_tnut', code: '10', name: '304 3030 M6 T型螺母', categoryId: 'fastener', compatibleProfileIds: ['3030'], sceneKind: null, extensionId: null },
] as const;

const profileEntries: DesignerModelCatalogEntry[] = PUBLIC_PROFILE_VARIANTS.map((profile) => ({
  id: `shitou.profile.${profile.id.toLowerCase()}`,
  categoryId: 'profile',
  names: { 'zh-CN': profile.name, en: profile.name, ja: profile.name },
  catalogSource: ['6060', '30120'].includes(profile.id)
    ? 'SketchUp铝型材拆分工具/catalog.json'
    : 'data/publicDesignData.PUBLIC_PROFILE_VARIANTS',
  sourceRecordId: profile.id,
  compatibleProfileIds: [profile.id],
  readiness: ['6060', '30120'].includes(profile.id)
    ? 'reference_asset_pending_calibration'
    : 'integrated_current_scope',
  uiExposure: 'profile_picker',
  extensionId: null,
  previewAssetStatus: PROFILE_PREVIEW_ASSETS.has(profile.id) ? 'available' : 'pending',
  pendingEvidence: PROFILE_PREVIEW_ASSETS.has(profile.id)
    ? []
    : ['cross_section_slot_geometry', 'wall_thickness_and_tolerance', 'threading_and_manufacturing_evidence'],
}));

/** Plugin profiles remain searchable source records but cannot enter the design canvas until their sections and pricing are calibrated. */
const pluginProfileReferenceEntries: DesignerModelCatalogEntry[] = ['6060', '30120'].map((profileId) => {
  const profile = PLUGIN_PROFILE_CATALOG.find((entry) => entry.id === profileId)!;
  return {
    id: `aluformula.plugin_profile.${profile.id}`,
    categoryId: 'profile',
    names: { 'zh-CN': profile.name, en: profile.name },
    catalogSource: 'SketchUp铝型材拆分工具/catalog.json',
    sourceRecordId: profile.id,
    compatibleProfileIds: [],
    readiness: 'reference_asset_pending_calibration',
    uiExposure: 'not_exposed',
    extensionId: null,
    previewAssetStatus: 'pending',
    pendingEvidence: ['exact_cross_section_geometry', 'wall_thickness_and_tolerance', 'verified_mass_and_supplier_price', 'manufacturing_and_json_export_support'],
  };
});

const accessoryEntries: DesignerModelCatalogEntry[] = COMMON_ACCESSORY_CATALOG.map((record) => {
  const isRegistered = Boolean(record.extensionId);
  const isLegacyDesignerPart = Boolean(record.sceneKind);
  return {
    id: `shitou.accessory.${record.id.toLowerCase()}`,
    categoryId: record.categoryId,
    names: { 'zh-CN': record.name, en: record.name },
    catalogSource: 'alufactory-backend/app/accessory_inventory.py.ACCESSORY_CATALOG',
    sourceRecordId: record.id,
    compatibleProfileIds: record.compatibleProfileIds,
    readiness: isRegistered
      ? 'integrated_current_scope'
      : isLegacyDesignerPart
        ? 'legacy_designer_pending_registry'
        : 'catalog_record_pending_model',
    uiExposure: record.categoryId === 'fastener'
      ? 'automatic_rule_only'
      : 'parts_palette',
    extensionId: record.extensionId,
    previewAssetStatus: 'not_applicable',
    pendingEvidence: isRegistered
      ? []
      : isLegacyDesignerPart
        ? ['shared_registry_mapping', 'manufacturing_validator', 'installation_evidence']
        : ['renderer_mapping', 'shared_registry_mapping', 'bom_mapping', 'installation_evidence'],
  } satisfies DesignerModelCatalogEntry;
});

const registeredMotionEntries: DesignerModelCatalogEntry[] = [
  {
    id: 'shitou.accessory.linear_shaft_d8',
    categoryId: 'linear_shaft',
    names: { 'zh-CN': DISPLAY_RACK_COMPONENT_CATALOG.SHAFT_8.name, en: 'Ø8 linear shaft g6' },
    catalogSource: 'data/displayRackComponentCatalog.DISPLAY_RACK_COMPONENT_CATALOG',
    sourceRecordId: DISPLAY_RACK_COMPONENT_CATALOG.SHAFT_8.id,
    compatibleProfileIds: ['3030'],
    readiness: 'integrated_current_scope',
    uiExposure: 'parts_palette',
    extensionId: 'mengkaile.accessory.linear_shaft_d8',
    previewAssetStatus: 'not_applicable',
    pendingEvidence: [],
  },
  {
    id: 'shitou.accessory.shaft_support_sk8',
    categoryId: 'shaft_support_clamp',
    names: { 'zh-CN': DISPLAY_RACK_COMPONENT_CATALOG.SK8.name, en: 'SK8 shaft support' },
    catalogSource: 'data/displayRackComponentCatalog.DISPLAY_RACK_COMPONENT_CATALOG',
    sourceRecordId: DISPLAY_RACK_COMPONENT_CATALOG.SK8.id,
    compatibleProfileIds: ['3030'],
    readiness: 'integrated_current_scope',
    uiExposure: 'parts_palette',
    extensionId: 'mengkaile.accessory.shaft_support_sk8',
    previewAssetStatus: 'available',
    pendingEvidence: [],
  },
  {
    id: 'shitou.accessory.shaft_support_shf8',
    categoryId: 'shaft_support_clamp',
    names: { 'zh-CN': DISPLAY_RACK_COMPONENT_CATALOG.SHF8.name, en: 'SHF8 flange shaft support' },
    catalogSource: 'data/displayRackComponentCatalog.DISPLAY_RACK_COMPONENT_CATALOG',
    sourceRecordId: DISPLAY_RACK_COMPONENT_CATALOG.SHF8.id,
    compatibleProfileIds: ['3030'],
    readiness: 'integrated_current_scope',
    uiExposure: 'parts_palette',
    extensionId: 'mengkaile.accessory.shaft_support_shf8',
    previewAssetStatus: 'pending',
    pendingEvidence: ['website_preview_asset'],
  },
  {
    id: 'shitou.accessory.drawer_slide_pair',
    categoryId: 'drawer_slide',
    names: { 'zh-CN': DISPLAY_RACK_COMPONENT_CATALOG.DRAWER_SLIDE_PAIR.name, en: 'Three-section drawer slide pair' },
    catalogSource: 'data/displayRackComponentCatalog.DISPLAY_RACK_COMPONENT_CATALOG',
    sourceRecordId: DISPLAY_RACK_COMPONENT_CATALOG.DRAWER_SLIDE_PAIR.id,
    compatibleProfileIds: ['3030'],
    readiness: 'integrated_current_scope',
    uiExposure: 'template_or_import_only',
    extensionId: 'mengkaile.accessory.drawer_slide_pair',
    previewAssetStatus: 'not_applicable',
    pendingEvidence: [],
  },
];

const registeredPanelEntries: DesignerModelCatalogEntry[] = [
  {
    id: 'shitou.material.marine_board',
    categoryId: 'panel',
    names: { 'zh-CN': '海洋板', en: 'Marine board', ja: 'マリンボード' },
    catalogSource: 'data/designerExtensionRegistry.BUILT_IN_DESIGNER_EXTENSION_PACK',
    sourceRecordId: 'marine',
    compatibleProfileIds: [],
    readiness: 'integrated_current_scope',
    uiExposure: 'parts_palette',
    extensionId: 'mengkaile.material.marine_board',
    previewAssetStatus: 'not_applicable',
    pendingEvidence: [],
  },
  {
    id: 'shitou.material.aluminum_plate',
    categoryId: 'panel',
    names: { 'zh-CN': '铝板', en: 'Aluminum plate', ja: 'アルミ板' },
    catalogSource: 'components/DIYDesigner.PALETTE_GROUPS',
    sourceRecordId: 'plate',
    compatibleProfileIds: [],
    readiness: 'legacy_designer_pending_registry',
    uiExposure: 'parts_palette',
    extensionId: null,
    previewAssetStatus: 'pending',
    pendingEvidence: ['material_grade', 'validated_stock_spec', 'surface_finish', 'cutting_validation', 'installation_evidence'],
  },
  {
    id: 'shitou.material.pegboard',
    categoryId: 'panel',
    names: { 'zh-CN': '洞洞板', en: 'Pegboard', ja: '有孔ボード' },
    catalogSource: 'components/DIYDesigner.PALETTE_GROUPS',
    sourceRecordId: 'pegboard',
    compatibleProfileIds: [],
    readiness: 'legacy_designer_pending_registry',
    uiExposure: 'parts_palette',
    extensionId: null,
    previewAssetStatus: 'pending',
    pendingEvidence: ['material_grade', 'validated_stock_spec', 'hole_pitch_and_tooling', 'cutting_validation', 'installation_evidence'],
  },
  {
    id: 'shitou.assembly.cabinet_door',
    categoryId: 'panel',
    names: { 'zh-CN': '柜门', en: 'Cabinet door', ja: 'キャビネット扉' },
    catalogSource: 'components/DIYDesigner.PALETTE_GROUPS',
    sourceRecordId: 'cabinet_door',
    compatibleProfileIds: [],
    readiness: 'legacy_designer_pending_registry',
    uiExposure: 'parts_palette',
    extensionId: null,
    previewAssetStatus: 'pending',
    pendingEvidence: ['validated_door_frame_profile', 'hinge_sku_and_mounting', 'physical_hinge_clearance', 'production_validation'],
  },
  {
    id: 'aluformula.material.ultra_clear_glass_10mm',
    categoryId: 'panel',
    names: { 'zh-CN': '超白玻璃 · 10 mm（规格待核）', en: 'Ultra-clear glass · 10 mm (specification pending)' },
    catalogSource: 'user_supplied_design_requirement',
    sourceRecordId: 'user.ultra_clear_glass_10mm',
    compatibleProfileIds: [],
    readiness: 'catalog_record_pending_model',
    uiExposure: 'not_exposed',
    extensionId: null,
    previewAssetStatus: 'pending',
    pendingEvidence: ['glass_supplier_and_grade', 'tempered_or_laminated_safety_spec', 'edge_finish', 'stock_sheet_size', 'cutting_and_hole_limits', 'frame_support_and_retention'],
  },
];

/**
 * The legacy canvas can render a generic foot/caster envelope, but no exact
 * purchasable model, thread, load or installation evidence is registered yet.
 * Keeping the gap records lets old files reopen without advertising fictional
 * hardware to new designs.
 */
const footCasterCoverageGapEntries: DesignerModelCatalogEntry[] = [
  {
    id: 'shitou.coverage.gap.leveling_foot',
    categoryId: 'foot_caster',
    names: { 'zh-CN': '调节地脚（具体型号待录入）', en: 'Leveling foot (exact model pending)', ja: 'アジャスターフット（型番未登録）' },
    catalogSource: 'components/DIYDesigner.PALETTE_GROUPS',
    sourceRecordId: 'gap.leveling_foot',
    compatibleProfileIds: [],
    readiness: 'catalog_record_pending_model',
    uiExposure: 'not_exposed',
    extensionId: null,
    previewAssetStatus: 'pending',
    pendingEvidence: ['manufacturer', 'exact_model', 'dimensions', 'thread_specification', 'load_rating', 'installation_evidence'],
  },
  {
    id: 'shitou.coverage.gap.threaded_caster',
    categoryId: 'foot_caster',
    names: { 'zh-CN': '丝杆脚轮（具体型号待录入）', en: 'Threaded caster (exact model pending)', ja: 'ねじ込みキャスター（型番未登録）' },
    catalogSource: 'components/DIYDesigner.PALETTE_GROUPS',
    sourceRecordId: 'gap.threaded_caster',
    compatibleProfileIds: [],
    readiness: 'catalog_record_pending_model',
    uiExposure: 'not_exposed',
    extensionId: null,
    previewAssetStatus: 'pending',
    pendingEvidence: ['manufacturer', 'exact_model', 'dimensions', 'thread_specification', 'load_rating', 'brake_type', 'installation_evidence'],
  },
];

/**
 * Exact source-model references from the companion SketchUp library. They are
 * exposed as editable design references while placement and interference rules
 * remain pending. They are never promoted to production by palette exposure.
 */
const referenceOnlyShaftEntries: DesignerModelCatalogEntry[] = [
  {
    id: 'shitou.reference.model_ref_cross_clamp_d8',
    categoryId: 'shaft_support_clamp',
    names: { 'zh-CN': 'Ø8直角交叉夹（原模型参考）', en: 'Ø8 right-angle cross clamp (source reference)' },
    catalogSource: 'SketchUp铝型材拆分工具/shaft_reference_library.json',
    sourceRecordId: 'MODEL_REF_CROSS_CLAMP_D8',
    compatibleProfileIds: [],
    readiness: 'reference_asset_pending_calibration',
    uiExposure: 'parts_palette',
    extensionId: 'mengkaile.accessory.shaft_cross_clamp_d8',
    previewAssetStatus: 'available',
    pendingEvidence: ['placement_interference_calibration', 'bom_mapping', 'installation_evidence'],
  },
  {
    id: 'shitou.reference.model_ref_collar_d8',
    categoryId: 'shaft_support_clamp',
    names: { 'zh-CN': 'Ø8开口止动夹环（原模型参考）', en: 'Ø8 split shaft collar (source reference)' },
    catalogSource: 'SketchUp铝型材拆分工具/shaft_reference_library.json',
    sourceRecordId: 'MODEL_REF_COLLAR_D8',
    compatibleProfileIds: [],
    readiness: 'reference_asset_pending_calibration',
    uiExposure: 'parts_palette',
    extensionId: 'mengkaile.accessory.shaft_collar_d8',
    previewAssetStatus: 'available',
    pendingEvidence: ['placement_interference_calibration', 'bom_mapping', 'installation_evidence'],
  },
];

const shaftCoverageGapEntries: DesignerModelCatalogEntry[] = SHAFT_SYSTEM_COVERAGE_GAPS.map((entry) => ({
  id: `shitou.coverage.${entry.id.replace(/[^a-z0-9._-]+/gi, '_').toLowerCase()}`,
  categoryId: entry.groupId === 'coupling_accessories' ? 'other_accessory' : 'shaft_support_clamp',
  names: entry.names,
  catalogSource: 'data/shaftSystemCatalog.SHAFT_SYSTEM_CATALOG',
  sourceRecordId: entry.id,
  compatibleProfileIds: [],
  readiness: 'catalog_record_pending_model',
  uiExposure: 'not_exposed',
  extensionId: null,
  previewAssetStatus: 'pending',
  pendingEvidence: entry.pendingEvidence,
}));

const referenceHardwareEntries: DesignerModelCatalogEntry[] = REFERENCE_HARDWARE_CATALOG.map((entry) => ({
  id: entry.id,
  categoryId: entry.categoryId,
  names: { 'zh-CN': entry.name, en: entry.name },
  catalogSource: 'data/referenceHardwareCatalog.REFERENCE_HARDWARE_CATALOG',
  sourceRecordId: entry.sceneType,
  compatibleProfileIds: entry.compatibleProfileIds,
  readiness: 'reference_asset_pending_calibration',
  uiExposure: 'parts_palette',
  extensionId: null,
  previewAssetStatus: 'available',
  pendingEvidence: entry.pendingEvidence,
}));

const linkedPluginSourceIds = new Set(REFERENCE_HARDWARE_CATALOG.flatMap((entry) => (
  entry.sourcePluginAssetId ? [entry.sourcePluginAssetId] : []
)));
const pluginSourceAccessoryEntries: DesignerModelCatalogEntry[] = PLUGIN_ACCESSORY_SOURCE_CATALOG
  .filter((entry) => !linkedPluginSourceIds.has(entry.sourceId))
  .map((entry) => ({
    id: entry.id,
    categoryId: entry.categoryId,
    names: { 'zh-CN': entry.name, en: entry.name },
    catalogSource: 'data/pluginAccessorySourceCatalog.PLUGIN_ACCESSORY_SOURCE_CATALOG',
    sourceRecordId: entry.sourceId,
    compatibleProfileIds: [],
    readiness: 'reference_asset_pending_calibration',
    uiExposure: 'not_exposed',
    extensionId: null,
    previewAssetStatus: 'available',
    pendingEvidence: [...entry.pendingEvidence, 'placement_and_bom_renderer_mapping'],
  }));

const entries: DesignerModelCatalogEntry[] = [
  ...profileEntries,
  ...pluginProfileReferenceEntries,
  ...registeredPanelEntries,
  ...accessoryEntries,
  ...registeredMotionEntries,
  ...referenceOnlyShaftEntries,
  ...shaftCoverageGapEntries,
  ...footCasterCoverageGapEntries,
  ...referenceHardwareEntries,
  ...pluginSourceAccessoryEntries,
];

const extensionIds = new Set([
  ...getDesignerExtensionRegistrySnapshot().materials.map((entry) => entry.id),
  ...getDesignerExtensionRegistrySnapshot().accessories.map((entry) => entry.id),
]);

entries.forEach((entry) => {
  if (entry.extensionId && !extensionIds.has(entry.extensionId)) {
    throw new Error(`Designer model catalog references an unknown extension: ${entry.extensionId}`);
  }
});

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  return value;
};

const snapshot: DesignerModelCatalogSnapshot = {
  categories: DESIGNER_MODEL_CATEGORIES,
  entries,
  counts: {
    integrated: entries.filter((entry) => entry.readiness === 'integrated_current_scope').length,
    pending: entries.filter((entry) => (
      entry.readiness === 'legacy_designer_pending_registry'
      || entry.readiness === 'catalog_record_pending_model'
    )).length,
    referenceOnly: entries.filter((entry) => entry.readiness === 'reference_asset_pending_calibration').length,
  },
};

export const getDesignerModelCatalogSnapshot = () => deepFreeze(snapshot) as DesignerModelCatalogSnapshot;

export const getDesignerModelCatalogCategoryEntries = (categoryId: DesignerModelCategoryId) => (
  getDesignerModelCatalogSnapshot().entries.filter((entry) => entry.categoryId === categoryId)
);
