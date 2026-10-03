import type { DesignerModelCategoryId } from './designerModelCatalog';

/**
 * Direct visual meshes from the user's Aluformula SketchUp plugin export.
 * Source identity and dimensional envelopes are retained separately from
 * installation fit and manufacturing evidence.
 */
export type PluginAccessorySourceId =
  | 'three-way-connector-s30'
  | 'leveling-foot-d100-m16-l100'
  | 'end-face-block-6060-m16'
  | 'zinc-hinge-3030-50x50'
  | 'screw-m6x16-ss304-thin-head'
  | 'end-cap-3030-diecast-4mm'
  | 'remote-cable-damper-305-400';

export interface PluginAccessorySourceEntry {
  readonly id: `aluformula.plugin_skp.${PluginAccessorySourceId}`;
  readonly sourceId: PluginAccessorySourceId;
  readonly componentName: string;
  readonly name: string;
  readonly categoryId: DesignerModelCategoryId;
  readonly sourceSceneType: string | null;
  readonly compatibleProfileIds: readonly string[];
  /** Native local XYZ bounds from the plugin SKP. */
  readonly sourceDimensionsMm: readonly [number, number, number];
  /** Web display bounds after applying the documented SketchUp Z-up mapping. */
  readonly displayDimensionsMm: readonly [number, number, number];
  readonly sourceMeshArchivePath: string;
  readonly sourceSkpPath: string;
  readonly precisionGlbPath: string;
  readonly sourceSha256: string;
  readonly pluginLibraryVersion: string;
  readonly thumbnailPath: null;
  readonly specifications: readonly { key: string; label: string; value: string; verification: 'source_observation' | 'pending' }[];
  readonly pendingEvidence: readonly string[];
}

const root = 'assets/accessory-models/plugin-accessories-20260929';
const sha256 = 'E1A025B09B19E062DD77BB396326F373C4198FBA91832B4A284CE341D2843F9F'.toLowerCase();
const skp = `${root}/source/配件.skp`;
const entry = (record: Omit<PluginAccessorySourceEntry,
  'id' | 'sourceSkpPath' | 'sourceSha256' | 'thumbnailPath' | 'sourceMeshArchivePath' | 'precisionGlbPath'>
  & { sourceId: PluginAccessorySourceId; pluginLibraryVersion: string }): PluginAccessorySourceEntry => ({
  ...record,
  id: `aluformula.plugin_skp.${record.sourceId}`,
  sourceSkpPath: skp,
  sourceSha256: sha256,
  thumbnailPath: null,
  sourceMeshArchivePath: `${root}/models/${record.sourceId}-source-mesh-v1.json`,
  precisionGlbPath: `models/accessories/plugin-accessories-20260929/${record.sourceId}/source-v1.glb`,
});

const commonPending = [
  'source_component_datum_and_orientation',
  'supplier_or_physical_dimensions_and_tolerances',
  'installation_interface_and_fasteners',
  'interference_and_clearance_review',
  'manufacturing_geometry_validation',
] as const;

export const PLUGIN_ACCESSORY_SOURCE_CATALOG: readonly PluginAccessorySourceEntry[] = [
  entry({
    sourceId: 'three-way-connector-s30',
    componentName: 'APS配件-30系列-三维端面连接件',
    name: '30 系列三维端面连接件（插件源模型）',
    categoryId: 'profile_connector',
    sourceSceneType: 'tee_connector',
    compatibleProfileIds: [],
    sourceDimensionsMm: [30, 30.825, 30],
    displayDimensionsMm: [30, 30, 30.825],
    pluginLibraryVersion: '2.50.2',
    specifications: [
      { key: 'plugin_identity', label: '插件组件标识', value: 'three_way · S30 / No.9 mesh v5', verification: 'source_observation' },
      { key: 'source_envelope', label: '源模型包络', value: '30 × 30.825 × 30 mm（SketchUp 本地 XYZ）', verification: 'source_observation' },
      { key: 'profile_fit', label: '适配型材', value: '30 系列名义件；具体截面、槽位和螺纹啮合待核', verification: 'pending' },
    ],
    pendingEvidence: [...commonPending, 'profile_series_fit_and_connection_topology'],
  }),
  entry({
    sourceId: 'leveling-foot-d100-m16-l100',
    componentName: 'APS配件-D100×M16×100 无孔调节地脚',
    name: 'D100 × M16 × 100 无孔调节地脚（插件源模型）',
    categoryId: 'foot_caster',
    sourceSceneType: 'leveling_foot_d100_m16_l100',
    compatibleProfileIds: [],
    sourceDimensionsMm: [100, 100, 118],
    displayDimensionsMm: [100, 118, 100],
    pluginLibraryVersion: '2.50.2',
    specifications: [
      { key: 'nominal_size', label: '插件型号', value: '底盘 D100 · M16 螺杆 × 100 mm · 无孔款', verification: 'source_observation' },
      { key: 'source_envelope', label: '源模型包络', value: '100 × 100 × 118 mm（SketchUp 本地 XYZ）', verification: 'source_observation' },
      { key: 'load_and_thread', label: '螺纹与承载', value: '螺距、有效啮合、可调行程及承载待核', verification: 'pending' },
    ],
    pendingEvidence: [...commonPending, 'thread_pitch_and_minimum_engagement', 'load_rating_and_adjustment_range'],
  }),
  entry({
    sourceId: 'end-face-block-6060-m16',
    componentName: 'APS配件-30系列-6060实心端面块 M16',
    name: '6060 实心端面块 M16（插件源模型）',
    categoryId: 'foot_caster',
    sourceSceneType: 'end_mount_6060_m16',
    compatibleProfileIds: ['6060'],
    sourceDimensionsMm: [11.4, 60, 60],
    displayDimensionsMm: [11.4, 60, 60],
    pluginLibraryVersion: '2.50.2',
    specifications: [
      { key: 'source_envelope', label: '源模型包络', value: '11.4 × 60 × 60 mm（SketchUp 本地 XYZ）', verification: 'source_observation' },
      { key: 'mounting_status', label: '安装孔与接口', value: '插件记录 mounting_unverified；不得据此生成 M8 攻丝', verification: 'pending' },
    ],
    pendingEvidence: [...commonPending, '6060_end_face_pattern_and_mounting_hole_dimensions', 'M16_thread_pitch_and_engagement'],
  }),
  entry({
    sourceId: 'zinc-hinge-3030-50x50',
    componentName: 'APS配件-3030加长锌合页',
    name: '3030 加长锌合页 50 × 50（插件源模型）',
    categoryId: 'profile_connector',
    sourceSceneType: null,
    compatibleProfileIds: ['3030'],
    sourceDimensionsMm: [50, 50, 12],
    displayDimensionsMm: [50, 12, 50],
    pluginLibraryVersion: '2.51.0',
    specifications: [
      { key: 'nominal_size', label: '插件型号', value: '3030 加长锌合页 · 50 × 50 × 12 mm 源包络', verification: 'source_observation' },
      { key: 'installation', label: '孔位与安装面', value: '插件记录 mounting_unverified；孔位和叶片基准待核', verification: 'pending' },
    ],
    pendingEvidence: [...commonPending, 'hinge_leaf_orientation_and_hole_pattern', 'opening_clearance_and_load_rating'],
  }),
  entry({
    sourceId: 'screw-m6x16-ss304-thin-head',
    componentName: 'APS配件-M6×16 内六角薄头螺丝（304）',
    name: 'M6 × 16 304 薄头内六角螺丝（插件源模型）',
    categoryId: 'fastener',
    sourceSceneType: null,
    compatibleProfileIds: [],
    sourceDimensionsMm: [11.9, 11.9, 17.4],
    displayDimensionsMm: [11.9, 17.4, 11.9],
    pluginLibraryVersion: '2.51.0',
    specifications: [
      { key: 'screw_size', label: '插件标称规格', value: 'M6 × 16 · 304 不锈钢 · 薄头内六角', verification: 'source_observation' },
      { key: 'source_envelope', label: '源模型包络', value: '11.9 × 11.9 × 17.4 mm；不等同于螺纹有效长度', verification: 'source_observation' },
      { key: 'tool_and_strength', label: '工具与强度', value: '头型细节、公差、强度等级和配套螺母待核', verification: 'pending' },
    ],
    pendingEvidence: [...commonPending, 'fastener_standard_strength_grade_and_tool_size'],
  }),
  entry({
    sourceId: 'end-cap-3030-diecast-4mm',
    componentName: 'APS配件-30系列-3030欧标压铸铝盖 · 4mm（图1）',
    name: '3030 欧标压铸铝盖 · 4 mm（插件源模型）',
    categoryId: 'end_cap',
    sourceSceneType: 'diecast_cap_3030_t4',
    compatibleProfileIds: ['3030'],
    // The component definition is locally oriented with its thin axis on X.
    // The placed plugin instance in the source scene was rotated to a 30×30
    // face with 4 mm thickness; the inventory's world bounds are not the
    // component-local manufacturing datum.
    sourceDimensionsMm: [4, 30, 30],
    displayDimensionsMm: [4, 30, 30],
    pluginLibraryVersion: '2.51.0',
    specifications: [
      { key: 'source_envelope', label: '组件定义局部包络', value: '4 × 30 × 30 mm（SketchUp 本地 XYZ）；场景实例旋转后为 30 × 30 × 4 mm', verification: 'source_observation' },
      { key: 'screw_interface', label: '螺丝接口', value: '孔径、沉头尺寸及定位舌未由源模型校准', verification: 'pending' },
    ],
    pendingEvidence: [...commonPending, 'bore_countersink_and_locating_geometry'],
  }),
  entry({
    sourceId: 'remote-cable-damper-305-400',
    componentName: 'APS配件-线控角度调节连动杆阻尼器（305/400）',
    name: '线控角度调节连动杆阻尼器 · 305 / 400（插件源模型）',
    categoryId: 'other_accessory',
    sourceSceneType: null,
    compatibleProfileIds: [],
    sourceDimensionsMm: [305, 198.85, 68.88],
    displayDimensionsMm: [305, 68.88, 198.85],
    pluginLibraryVersion: '2.52.0',
    specifications: [
      { key: 'preview_envelope', label: '源模型包络', value: '305 × 198.85 × 68.88 mm；为拆开放置预览包络，不是安装包络', verification: 'source_observation' },
      { key: 'stroke', label: '行程与安装', value: '305 mm 不是阻尼行程；有效行程、阻尼力及安装方向待核', verification: 'pending' },
    ],
    pendingEvidence: [...commonPending, 'installed_envelope_and_pivot_coordinates', 'damper_force_stroke_and_release_travel'],
  }),
] as const;

export const getPluginAccessorySource = (id?: string | null): PluginAccessorySourceEntry | null => (
  PLUGIN_ACCESSORY_SOURCE_CATALOG.find((candidate) => candidate.id === id || candidate.sourceId === id) || null
);
