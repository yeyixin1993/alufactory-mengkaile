/**
 * User-supplied hardware references, received 2026-09-28.
 * Dimensions printed on a photograph are source observations, not measurements
 * of a delivered SKU. Inferred geometry is kept separate and never grants
 * manufacturing or load approval. This module intentionally contains no price.
 */
export type ReferenceHardwareSceneType =
  | 'diecast_cap_3030_t48'
  | 'diecast_cap_3030_t4'
  | 'end_mount_6060_m16'
  | 'leveling_foot_d100_m16_l100';

export interface ReferenceHardwareSpecification {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly verification: 'source_observation' | 'pending';
}

export interface ReferenceHardwareCatalogEntry {
  readonly id: string;
  readonly sceneType: ReferenceHardwareSceneType;
  readonly name: string;
  readonly categoryId: 'end_cap' | 'foot_caster';
  readonly familyId: string;
  /** Local model envelope, in millimetres; caps/plate face +Z, foot shaft +Y. */
  readonly dimensionsMm: readonly [number, number, number];
  readonly thumbnailPath: string;
  readonly specifications: readonly ReferenceHardwareSpecification[];
  readonly observedDimensions: Readonly<Record<string, number | string>>;
  readonly inferredDimensions: Readonly<Record<string, number | string>>;
  readonly pendingEvidence: readonly string[];
  readonly installationNotes: readonly string[];
  /** Reference product labels only; does not prove installation compatibility. */
  readonly compatibleProfileIds: readonly string[];
  readonly sourceImagePath: string;
  /** Direct plugin-exported SKP mesh; visual reuse only until installation is calibrated. */
  readonly sourcePluginAssetId?: string;
  readonly sourceEvidence: Readonly<{
    origin: 'user_supplied_image';
    receivedOn: '2026-09-28';
    manifestPath: string;
    manufacturingStatus: 'blocked_missing_evidence';
  }>;
}

const sourceDirectory = 'assets/references/hardware/20260928';
const sourceEvidence: ReferenceHardwareCatalogEntry['sourceEvidence'] = {
  origin: 'user_supplied_image',
  receivedOn: '2026-09-28',
  manifestPath: `${sourceDirectory}/source-manifest.json`,
  manufacturingStatus: 'blocked_missing_evidence',
};
const thumbnail = (sceneType: ReferenceHardwareSceneType) => `/images/accessory/reference-hardware/${sceneType}.svg`;
const observation = (key: string, label: string, value: string): ReferenceHardwareSpecification => ({
  key, label, value, verification: 'source_observation',
});
const pending = (key: string, label: string, value: string): ReferenceHardwareSpecification => ({
  key, label, value, verification: 'pending',
});

export const REFERENCE_HARDWARE_CATALOG: readonly ReferenceHardwareCatalogEntry[] = [
  {
    id: 'aluformula.reference.diecast_cap_3030_t48',
    sceneType: 'diecast_cap_3030_t48',
    name: '3030 金属端盖 · 4.8 mm',
    categoryId: 'end_cap',
    familyId: 'closure.diecast_end_cap',
    dimensionsMm: [30, 30, 4.8],
    thumbnailPath: thumbnail('diecast_cap_3030_t48'),
    specifications: [
      observation('envelope', '图示外形', '30 × 30 × 4.8 mm'),
      observation('center_bore', '中心通孔', 'Ø8.5 mm；不是 M8 内螺纹'),
      pending('seat_geometry', '沉头与背面', '沉头大径、角度、深度及背面定位细节待核'),
    ],
    observedDimensions: { widthMm: 30, heightMm: 30, thicknessMm: 4.8, centerBoreDiameterMm: 8.5, rearAnnotation: '局部标注 8 mm，指向与含义待核' },
    inferredDimensions: { countersinkOuterDiameterMm: 15, countersinkDepthMm: 1.8, rearCavityDepthMm: 1.4, rearRimWidthMm: 1.3, rearBossDiameterMm: 15, roundedCornersAndRecess: '圆角、沉头及背面凹腔为外观推定，背面局部 8 mm 标注不用于放行' },
    pendingEvidence: ['supplier_sku', 'material_and_finish', 'countersink_diameter_angle_depth', 'rear_locating_geometry', 'fastener_and_profile_tap', 'installation_evidence'],
    installationNotes: [
      '本地 XY 为端盖面，+Z 为可见正面，中心通孔沿 Z。',
      '靠端面安装并核对螺丝头座面；盖孔不表示型材已攻丝，连接螺丝与型材端孔需另核。',
      '4.8 mm 与 4 mm 为两个独立参考型号，不得互换厚度或沉头资料。',
    ],
    compatibleProfileIds: ['3030'],
    sourceImagePath: `${sourceDirectory}/7247d5fb10defa6805c189cd6fbef427.jpg`,
    sourceEvidence,
  },
  {
    id: 'aluformula.reference.diecast_cap_3030_t4',
    sceneType: 'diecast_cap_3030_t4',
    name: '3030 欧标压铸铝盖 · 4 mm',
    categoryId: 'end_cap',
    familyId: 'closure.diecast_end_cap',
    dimensionsMm: [30, 30, 4],
    thumbnailPath: thumbnail('diecast_cap_3030_t4'),
    specifications: [
      observation('envelope', '图示外形', '30 × 30 × 4 mm'),
      observation('screw_interface', '图示螺丝接口', 'M8 沉头螺丝孔；不是 M8 内螺纹'),
      pending('bore_and_seat', '孔径与沉头', '通孔 Ø8.5 mm 仅为显示预估；沉头大径、角度及深度待核'),
    ],
    observedDimensions: { widthMm: 30, heightMm: 30, thicknessMm: 4, screwLabel: '沉头孔 M8', productLabel: '3030 欧标压铸铝盖' },
    inferredDimensions: { centerBoreDiameterMm: 8.5, countersinkOuterDiameterMm: 15, countersinkDepthMm: 1.8, rearCavityDepthMm: 1.4, rearRimWidthMm: 1.3, rearBossDiameterMm: 15, locatingTongueEnvelope: '6 × 2.3 × 1.4 mm（保持在 30 × 30 外包络内的显示预估）', roundedCornersAndRecess: '沉头、圆角及底部定位舌均未实测，不可作为加工尺寸' },
    pendingEvidence: ['supplier_sku', 'material_and_finish', 'clearance_bore_diameter', 'countersink_diameter_angle_depth', 'locating_tab_dimensions', 'fastener_and_profile_tap', 'installation_evidence'],
    installationNotes: [
      '本地 XY 为端盖面，+Z 为可见正面，孔沿 Z。',
      'M8 标注描述配用沉头螺丝规格，不得据此给盖板生成 M8 攻丝。',
      '模型定位舌为未标尺寸的外观预估，保持在 30 × 30 外包络内；须与所选 3030 截面试装核对。',
    ],
    compatibleProfileIds: ['3030'],
    sourceImagePath: `${sourceDirectory}/f5f214f6c1ef3994c0dca44241585f1e.png`,
    sourcePluginAssetId: 'end-cap-3030-diecast-4mm',
    sourceEvidence,
  },
  {
    id: 'aluformula.reference.end_mount_6060_m16',
    sceneType: 'end_mount_6060_m16',
    name: '6060 端面安装块 · M16',
    categoryId: 'foot_caster',
    familyId: 'general.foot_mount_plate',
    dimensionsMm: [60, 60, 11.4],
    thumbnailPath: thumbnail('end_mount_6060_m16'),
    specifications: [
      observation('envelope', '图示外形', '60 × 60 × 11.4 mm'),
      observation('center_thread', '中央螺纹', 'M16；螺距未标'),
      observation('mounting_pattern', '四孔布局', '四孔中心距 30 × 30 mm；图标通孔 M8'),
      pending('mounting_bore', '安装孔细节', 'M8 是配用螺丝标注，实际通孔径与沉孔尺寸待核'),
    ],
    observedDimensions: { widthMm: 60, heightMm: 60, thicknessMm: 11.4, centerThread: 'M16（未标螺距）', mountingHoleCount: 4, mountingPitchXmm: 30, mountingPitchYmm: 30, mountingHoleLabel: '通孔 M8' },
    inferredDimensions: { mountingBoreDiameterMm: 8.5, counterboreDiameterMm: 14, counterboreDepthMm: 4, centerBoreVisualization: '中心孔仅显示名义 M16 开口，不表示加工底孔尺寸', counterboreGeometry: '背面沉孔大径与深度为显示预估，孔座型式待核' },
    pendingEvidence: ['supplier_sku', 'material_and_finish', 'm16_thread_pitch_and_engagement', 'mounting_clearance_bore_diameter', 'counterbore_type_diameter_depth', '6060_profile_end_hole_layout', 'mounting_fasteners', 'load_rating', 'installation_evidence'],
    installationNotes: [
      '本地 XY 为端面安装平面，+Z 为沉孔侧（原图背面），中心螺纹轴与四安装孔均沿 Z。',
      '四安装孔中心为 X/Y 各 ±15 mm；需核对所用 6060 型材端面孔位、端部攻丝及紧固件。',
      '中央 M16 可作为 M16 地脚的候选接口，须复核螺距和有效啮合；不能套入通用 3030 M8 攻丝规则。',
    ],
    compatibleProfileIds: ['6060'],
    sourceImagePath: `${sourceDirectory}/fc4dba5366150744e22e6588f7590b76.jpg`,
    sourcePluginAssetId: 'end-face-block-6060-m16',
    sourceEvidence,
  },
  {
    id: 'aluformula.reference.leveling_foot_d100_m16_l100',
    sceneType: 'leveling_foot_d100_m16_l100',
    name: '调节地脚 · D100 / M16 × 100',
    categoryId: 'foot_caster',
    familyId: 'general.leveling_foot',
    dimensionsMm: [100, 120, 100],
    thumbnailPath: thumbnail('leveling_foot_d100_m16_l100'),
    specifications: [
      observation('base_diameter', '底盘直径', 'D100 mm；无孔款'),
      observation('thread', '螺杆规格', 'M16 × 100 mm；100 为螺纹长度'),
      pending('envelope', '预估模型外形', '100 × 120 × 100 mm；底盘高暂按 20 mm，总高 120 mm 为推定'),
      pending('connection_and_load', '接口与承载', '螺距、实际调节行程、最小啮合及承载待核'),
    ],
    observedDimensions: { baseDiameterMm: 100, nominalThread: 'M16（未标螺距）', threadedShaftLengthMm: 100, baseMountingHoles: '无孔款' },
    inferredDimensions: { baseHeightMm: 20, overallHeightMm: 120, upperNutAcrossFlatsMm: 24, upperNutHeightMm: 12, lowerCollarAcrossFlatsMm: 20, lowerCollarHeightMm: 7, baseContourAndNuts: '底盘轮廓、锁紧螺母及底部连接件尺寸为外观预估' },
    pendingEvidence: ['supplier_sku', 'material_and_finish', 'base_height_and_contour', 'nut_dimensions', 'm16_thread_pitch', 'adjustment_range_and_minimum_engagement', 'load_rating', 'installation_evidence'],
    installationNotes: [
      '本地 +Y 为螺杆方向，模型原点位于预估包络中心；底面 Y = −60 mm，螺杆范围 Y = −40 至 +60 mm。',
      '需连接匹配 M16 的已核安装块或端孔，不能直接匹配既有 3030 M8 中心攻丝。',
      '螺杆长 100 mm 不等于成品总高或可调行程，安装总高随啮合深度变化；本模型不提供承载结论。',
    ],
    compatibleProfileIds: [],
    sourceImagePath: `${sourceDirectory}/93c434e6e9270384db99fa59f57e3d45.jpg`,
    sourcePluginAssetId: 'leveling-foot-d100-m16-l100',
    sourceEvidence,
  },
];

export const getReferenceHardwareBySceneType = (type?: string): ReferenceHardwareCatalogEntry | null => (
  REFERENCE_HARDWARE_CATALOG.find((entry) => entry.sceneType === type) || null
);
