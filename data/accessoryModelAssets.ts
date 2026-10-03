/**
 * ALUFORMULA-owned accessory model asset registry.
 *
 * Rendering files and engineering source files deliberately remain separate:
 * GLB is the web visual, SKP is a retained source reference when available,
 * and DXF is a review drawing. None of these paths by itself makes a part
 * production-ready.
 */

import { DESIGNER_MM_PER_SCENE_UNIT } from '../utils/designerSceneUnits';

export type AccessoryVisualLevel = 'simple' | 'precision';

export type AccessoryModelAssetId =
  | 'aluformula.shaft.reference_parallel_d8'
  | 'aluformula.shaft.reference_t_d8'
  | 'aluformula.shaft.cross_clamp_d8'
  | 'aluformula.shaft.collar_d8'
  | 'aluformula.shaft.support_sk8'
  | 'aluformula.shaft.support_shf8'
  | 'aluformula.connector.no1_2020'
  | 'aluformula.connector.no1_3030'
  | 'aluformula.connector.no5_2020'
  | 'aluformula.connector.no5_3030'
  | 'aluformula.connector.no2_1515'
  | 'aluformula.connector.no2_2020'
  | 'aluformula.connector.no2_3030'
  | 'aluformula.connector.no7l_1515'
  | 'aluformula.connector.no7l_2020'
  | 'aluformula.connector.no7l_3030'
  | 'aluformula.connector.no7l_4040'
  | 'aluformula.connector.no7t_1515'
  | 'aluformula.connector.no7t_2020'
  | 'aluformula.connector.no7t_3030'
  | 'aluformula.connector.no7t_4040'
  | 'aluformula.connector.no9_1515'
  | 'aluformula.connector.no9_2020'
  | 'aluformula.connector.no9_3030';

export interface AccessoryPlacementAnchor {
  readonly id: string;
  readonly role: 'mounting_seat' | 'fastener_axis' | 'slot_axis' | 'shaft_axis';
  readonly positionMm: readonly [number, number, number];
  readonly normal: readonly [number, number, number];
}

export interface AccessoryCollisionBox {
  readonly id: string;
  readonly centerMm: readonly [number, number, number];
  readonly sizeMm: readonly [number, number, number];
}

export interface AccessoryModelAssetRecord {
  readonly id: AccessoryModelAssetId;
  readonly revision: string;
  readonly catalogItemId: string;
  readonly sceneTypes: readonly string[];
  /** Empty means the asset is not profile-series dependent. */
  readonly compatibleProfileIds: readonly string[];
  readonly labels: Readonly<Record<'zh-CN' | 'en' | 'ja', string>>;
  /** Catalog envelope in millimetres; axis order follows the catalog record. */
  readonly dimensionsMm: readonly [number, number, number];
  /** Width/height/thickness values used by the parametric scene item. */
  readonly sceneDimensionsMm: readonly [number, number, number];
  readonly simple: {
    readonly renderer: 'procedural';
    readonly purpose: 'fast_interaction_and_fallback';
  };
  readonly precision: {
    readonly state: 'available';
    readonly glbPublicPath: string;
    readonly meshProvenance:
      | 'aluformula_reconstruction_from_verified_reference'
      | 'aluformula_visual_reconstruction_from_existing_validator'
      | 'supplier_drawing_and_photo_visual_reconstruction'
      | 'direct_retained_skp_tessellation';
    readonly sourceConversion?: {
      readonly archivePath: string;
      readonly skpSha256: string;
      readonly transformPolicy: 'source_xyz_mm_centered_only';
    };
    readonly supplierReference?: {
      readonly productUrl: string;
      readonly selectedSku: string;
      readonly checkedDimensions: string;
      readonly estimatedDetails: readonly string[];
      readonly referenceOnly: boolean;
      readonly retainedSourceGlbPath: string | null;
      readonly evidencePaths?: readonly string[];
    };
    readonly productionGeometry: false;
    /** The checked-in GLBs use millimetres and are scaled into the web scene. */
    readonly millimetresPerSceneUnit: typeof DESIGNER_MM_PER_SCENE_UNIT;
    readonly rotationDeg: readonly [number, number, number];
    readonly offsetMm: readonly [number, number, number];
  };
  readonly sourceFiles: {
    readonly skpPath: string | null;
    readonly skpStatus: 'retained_verified_reference' | 'pending_supplier_or_calibrated_source';
    readonly previewPath: string | null;
    readonly cadPath: string | null;
    readonly cadFormat: 'DXF';
    readonly cadStatus: 'reference_envelope_not_for_manufacture' | 'pending';
  };
  readonly placement: {
    readonly originConvention: 'scene_item_local_origin';
    readonly calibrationStatus: 'visual_origin_only' | 'aligned_to_existing_validator';
    readonly anchors: readonly AccessoryPlacementAnchor[];
    readonly collisionBoxes: readonly AccessoryCollisionBox[];
  };
  readonly release: {
    readonly visualReview: 'ready';
    readonly sourceMeshCalibration: 'pending';
    readonly productionReady: false;
  };
  readonly pendingEvidence: readonly string[];
}

const record = (
  value: Omit<AccessoryModelAssetRecord, 'simple' | 'precision' | 'release'> & {
    precisionPath: string;
    meshProvenance?: AccessoryModelAssetRecord['precision']['meshProvenance'];
    rotationDeg?: readonly [number, number, number];
    offsetMm?: readonly [number, number, number];
    sourceConversion?: AccessoryModelAssetRecord['precision']['sourceConversion'];
    supplierReference?: AccessoryModelAssetRecord['precision']['supplierReference'];
  },
): AccessoryModelAssetRecord => ({
  id: value.id,
  revision: value.revision,
  catalogItemId: value.catalogItemId,
  sceneTypes: value.sceneTypes,
  compatibleProfileIds: value.compatibleProfileIds,
  labels: value.labels,
  dimensionsMm: value.dimensionsMm,
  sceneDimensionsMm: value.sceneDimensionsMm,
  simple: {
    renderer: 'procedural',
    purpose: 'fast_interaction_and_fallback',
  },
  precision: {
    state: 'available',
    glbPublicPath: value.precisionPath,
    meshProvenance: value.meshProvenance || 'aluformula_reconstruction_from_verified_reference',
    sourceConversion: value.sourceConversion,
    supplierReference: value.supplierReference,
    productionGeometry: false,
    millimetresPerSceneUnit: DESIGNER_MM_PER_SCENE_UNIT,
    rotationDeg: value.rotationDeg || [0, 0, 0],
    offsetMm: value.offsetMm || [0, 0, 0],
  },
  sourceFiles: value.sourceFiles,
  placement: value.placement,
  release: {
    visualReview: 'ready',
    sourceMeshCalibration: 'pending',
    productionReady: false,
  },
  pendingEvidence: value.pendingEvidence,
});

const visualPlacement = (
  dimensionsMm: readonly [number, number, number],
): AccessoryModelAssetRecord['placement'] => ({
  originConvention: 'scene_item_local_origin',
  calibrationStatus: 'visual_origin_only',
  anchors: [],
  collisionBoxes: [{ id: 'visual-envelope', centerMm: [0, 0, 0], sizeMm: dimensionsMm }],
});

const connectorPlacement = (
  kind: 'no1' | 'no5',
  moduleSize: 20 | 30,
): AccessoryModelAssetRecord['placement'] => {
  if (kind === 'no1') {
    const width = moduleSize;
    const height = moduleSize === 20 ? 28 : 30;
    const wall = Math.min(6, Math.max(2.6, moduleSize * 0.18));
    return {
      originConvention: 'scene_item_local_origin',
      calibrationStatus: 'aligned_to_existing_validator',
      anchors: [
        { id: 'seat-horizontal', role: 'mounting_seat', positionMm: [width * 0.5, 0, 0], normal: [0, -1, 0] },
        { id: 'seat-vertical', role: 'mounting_seat', positionMm: [0, height * 0.5, 0], normal: [-1, 0, 0] },
        { id: 'fastener-horizontal', role: 'fastener_axis', positionMm: [width * 0.58, wall, 0], normal: [0, 1, 0] },
        { id: 'fastener-vertical', role: 'fastener_axis', positionMm: [wall, height * 0.58, 0], normal: [1, 0, 0] },
      ],
      collisionBoxes: [
        { id: 'horizontal-arm', centerMm: [width * 0.5, wall * 0.5, 0], sizeMm: [width, wall, moduleSize] },
        { id: 'vertical-arm', centerMm: [wall * 0.5, height * 0.5, 0], sizeMm: [wall, height, moduleSize] },
      ],
    };
  }
  const length = moduleSize * 1.4;
  const arm = moduleSize * 0.42;
  const depth = Math.max(2.5, moduleSize * 0.14);
  return {
    originConvention: 'scene_item_local_origin',
    calibrationStatus: 'aligned_to_existing_validator',
    anchors: [
      { id: 'slot-horizontal', role: 'slot_axis', positionMm: [length * 0.58, arm * 0.5, depth * 0.5], normal: [0, 0, 1] },
      { id: 'slot-vertical', role: 'slot_axis', positionMm: [arm * 0.5, length * 0.58, depth * 0.5], normal: [0, 0, 1] },
    ],
    collisionBoxes: [
      { id: 'horizontal-arm', centerMm: [length * 0.5, arm * 0.5, 0], sizeMm: [length, arm, depth] },
      { id: 'vertical-arm', centerMm: [arm * 0.5, length * 0.5, 0], sizeMm: [arm, length, depth] },
    ],
  };
};

const extrudedBracketPlacement = (
  moduleSize: 15 | 20 | 30,
): AccessoryModelAssetRecord['placement'] => {
  const length = 50;
  const wall = Math.min(7, Math.max(3.2, moduleSize * 0.22));
  return {
    originConvention: 'scene_item_local_origin',
    calibrationStatus: 'aligned_to_existing_validator',
    anchors: [
      { id: 'seat-horizontal', role: 'mounting_seat', positionMm: [length * 0.5, 0, 0], normal: [0, -1, 0] },
      { id: 'seat-vertical', role: 'mounting_seat', positionMm: [0, length * 0.5, 0], normal: [-1, 0, 0] },
      { id: 'fastener-horizontal', role: 'fastener_axis', positionMm: [length * 0.58, wall, 0], normal: [0, 1, 0] },
      { id: 'fastener-vertical', role: 'fastener_axis', positionMm: [wall, length * 0.58, 0], normal: [1, 0, 0] },
    ],
    collisionBoxes: [
      { id: 'horizontal-arm', centerMm: [length * 0.5, wall * 0.5, 0], sizeMm: [length, wall, moduleSize] },
      { id: 'vertical-arm', centerMm: [wall * 0.5, length * 0.5, 0], sizeMm: [wall, length, moduleSize] },
    ],
  };
};

const flatPlatePlacement = (
  kind: 'l' | 't',
  width: number,
  height: number,
  armWidth: number,
): AccessoryModelAssetRecord['placement'] => ({
  originConvention: 'scene_item_local_origin',
  calibrationStatus: 'aligned_to_existing_validator',
  anchors: (kind === 'l'
    ? [
        [width * 0.34, 0, 1],
        [width * 0.72, 0, 1],
        [0, height * 0.34, 1],
        [0, height * 0.72, 1],
      ]
    : [
        [-width * 0.31, 0, 1],
        [width * 0.31, 0, 1],
        [0, height * 0.34, 1],
        [0, height * 0.72, 1],
      ]
  ).map((positionMm, index) => ({
    id: `fastener-${index + 1}`,
    role: 'fastener_axis' as const,
    positionMm: positionMm as [number, number, number],
    normal: [0, 0, 1] as const,
  })),
  collisionBoxes: kind === 'l'
    ? [
        { id: 'horizontal-arm', centerMm: [width * 0.5, 0, 0], sizeMm: [width, armWidth, 2] },
        { id: 'vertical-arm', centerMm: [0, height * 0.5, 0], sizeMm: [armWidth, height, 2] },
      ]
    : [
        { id: 'crossbar', centerMm: [0, 0, 0], sizeMm: [width, armWidth, 2] },
        { id: 'stem', centerMm: [0, height * 0.5, 0], sizeMm: [armWidth, height, 2] },
      ],
});

const threeWayPlacement = (moduleSize: 15 | 20 | 30): AccessoryModelAssetRecord['placement'] => ({
  originConvention: 'scene_item_local_origin',
  calibrationStatus: 'aligned_to_existing_validator',
  anchors: [
    { id: 'seat-x', role: 'mounting_seat', positionMm: [moduleSize * 0.5, 0, 0], normal: [1, 0, 0] },
    { id: 'seat-y', role: 'mounting_seat', positionMm: [0, -moduleSize * 0.5, 0], normal: [0, -1, 0] },
    { id: 'seat-z', role: 'mounting_seat', positionMm: [0, 0, moduleSize * 0.5], normal: [0, 0, 1] },
  ],
  collisionBoxes: [
    { id: 'connector-core', centerMm: [0, 0, 0], sizeMm: [moduleSize, moduleSize, moduleSize] },
  ],
});

const visualConnectorRecord = (input: {
  id: AccessoryModelAssetId;
  catalogItemId: string;
  sceneType: string;
  series: '1515' | '2020' | '3030' | '4040';
  labels: AccessoryModelAssetRecord['labels'];
  dimensionsMm: readonly [number, number, number];
  sceneDimensionsMm?: readonly [number, number, number];
  folder: string;
  previewFile: '2.svg' | '7L.svg' | '7T.svg' | '9.svg';
  placement: AccessoryModelAssetRecord['placement'];
}) => record({
  id: input.id,
  revision: 'precision-v1',
  catalogItemId: input.catalogItemId,
  sceneTypes: [input.sceneType],
  compatibleProfileIds: [input.series],
  labels: input.labels,
  dimensionsMm: input.dimensionsMm,
  sceneDimensionsMm: input.sceneDimensionsMm || input.dimensionsMm,
  precisionPath: `models/accessories/${input.folder}/precision-v1.glb`,
  meshProvenance: 'aluformula_visual_reconstruction_from_existing_validator',
  sourceFiles: {
    skpPath: null,
    skpStatus: 'pending_supplier_or_calibrated_source',
    previewPath: `public/images/accessory/${input.previewFile}`,
    cadPath: `assets/accessory-models/${input.folder}/cad/${input.folder}-reference.dxf`,
    cadFormat: 'DXF',
    cadStatus: 'reference_envelope_not_for_manufacture',
  },
  placement: input.placement,
  pendingEvidence: ['supplier_skp_or_scan', 'source_mesh_calibration', 'production_dimensions', 'fastener_and_tool_evidence'],
});

const EXTRUDED_BRACKET_ASSETS = ([15, 20, 30] as const).map((moduleSize) => {
  const series = `${moduleSize}${moduleSize}` as '1515' | '2020' | '3030';
  return visualConnectorRecord({
    id: `aluformula.connector.no2_${series}`,
    catalogItemId: 'aluformula.connector.reinforced_extruded_bracket',
    sceneType: 'extruded_connector',
    series,
    labels: { 'zh-CN': `${series} 加强型挤压角座`, en: `${series} reinforced extruded bracket`, ja: `${series} 補強押出ブラケット` },
    dimensionsMm: [50, 50, moduleSize],
    folder: `connector-no2-${series}`,
    previewFile: '2.svg',
    placement: extrudedBracketPlacement(moduleSize),
  });
});

const FLAT_PLATE_ASSETS = ([15, 20, 30, 40] as const).flatMap((profileModule) => {
  const series = `${profileModule}${profileModule}` as '1515' | '2020' | '3030' | '4040';
  const geometryModule = profileModule <= 20 ? 20 : profileModule;
  const lWidth = geometryModule * 3;
  const tHeight = geometryModule * 3.25;
  return [
    visualConnectorRecord({
      id: `aluformula.connector.no7l_${series}`,
      catalogItemId: 'aluformula.connector.flat_l_plate',
      sceneType: 'l_connector',
      series,
      labels: { 'zh-CN': `${series} L型连接板`, en: `${series} L-shaped connecting plate`, ja: `${series} L型連結プレート` },
      dimensionsMm: [lWidth + geometryModule * 0.5, lWidth + geometryModule * 0.5, 2],
      sceneDimensionsMm: [lWidth, lWidth, 2],
      folder: `connector-no7l-${series}`,
      previewFile: '7L.svg',
      placement: flatPlatePlacement('l', lWidth, lWidth, geometryModule),
    }),
    visualConnectorRecord({
      id: `aluformula.connector.no7t_${series}`,
      catalogItemId: 'aluformula.connector.flat_t_plate',
      sceneType: 't_connector',
      series,
      labels: { 'zh-CN': `${series} T型连接板`, en: `${series} T-shaped connecting plate`, ja: `${series} T型連結プレート` },
      dimensionsMm: [lWidth, tHeight + geometryModule * 0.5, 2],
      sceneDimensionsMm: [lWidth, tHeight, 2],
      folder: `connector-no7t-${series}`,
      previewFile: '7T.svg',
      placement: flatPlatePlacement('t', lWidth, tHeight, geometryModule),
    }),
  ];
});

const THREE_WAY_ASSETS = ([15, 20, 30] as const).map((moduleSize) => {
  const series = `${moduleSize}${moduleSize}` as '1515' | '2020' | '3030';
  return visualConnectorRecord({
    id: `aluformula.connector.no9_${series}`,
    catalogItemId: 'aluformula.connector.three_way_corner',
    sceneType: 'tee_connector',
    series,
    labels: { 'zh-CN': `${series} 三维角连接件`, en: `${series} three-way corner connector`, ja: `${series} 三方向コーナーコネクタ` },
    dimensionsMm: [moduleSize, moduleSize, moduleSize],
    folder: `connector-no9-${series}`,
    previewFile: '9.svg',
    placement: threeWayPlacement(moduleSize),
  });
});

/** Audit baseline: unchanged source-v2 tessellations remain available for comparison. */
export const RETAINED_ACCESSORY_MODEL_ASSETS: readonly AccessoryModelAssetRecord[] = [
  record({
    id: 'aluformula.shaft.cross_clamp_d8',
    revision: 'source-v2',
    catalogItemId: 'mengkaile.accessory.shaft_cross_clamp_d8',
    sceneTypes: ['shaft_support_cross_d8'],
    compatibleProfileIds: [],
    labels: { 'zh-CN': 'Ø8 十字固定夹', en: 'Ø8 cross clamp', ja: 'Ø8 クロスクランプ' },
    dimensionsMm: [15, 41, 15],
    sceneDimensionsMm: [15, 41, 15],
    precisionPath: 'models/accessories/shaft-cross-clamp-d8/source-v2.glb',
    meshProvenance: 'direct_retained_skp_tessellation',
    sourceConversion: { archivePath: 'assets/accessory-models/shaft-cross-clamp-d8/source-mesh-v2.json', skpSha256: 'be33e0f0cc06fa195026a448ae3c478a2a4ae4a0933851c3e7551b616e4c24e1', transformPolicy: 'source_xyz_mm_centered_only' },
    sourceFiles: {
      skpPath: 'assets/accessory-models/shaft-cross-clamp-d8/source/shaft-cross-clamp-d8.skp',
      skpStatus: 'retained_verified_reference',
      previewPath: 'assets/accessory-models/shaft-cross-clamp-d8/reference/shaft-cross-clamp-d8.png',
      cadPath: 'assets/accessory-models/shaft-cross-clamp-d8/cad/shaft-cross-clamp-d8-reference.dxf',
      cadFormat: 'DXF',
      cadStatus: 'reference_envelope_not_for_manufacture',
    },
    placement: visualPlacement([15, 41, 15]),
    pendingEvidence: ['source_mesh_origin_calibration', 'production_geometry_validation'],
  }),
  record({
    id: 'aluformula.shaft.collar_d8',
    revision: 'source-v2',
    catalogItemId: 'mengkaile.accessory.shaft_collar_d8',
    sceneTypes: ['shaft_support_collar_d8'],
    compatibleProfileIds: [],
    labels: { 'zh-CN': 'Ø8 开口固定环', en: 'Ø8 split collar', ja: 'Ø8 スプリットカラー' },
    dimensionsMm: [24.9895, 24.9833, 8],
    sceneDimensionsMm: [24.9895, 24.9833, 8],
    precisionPath: 'models/accessories/shaft-collar-d8/source-v2.glb',
    meshProvenance: 'direct_retained_skp_tessellation',
    sourceConversion: { archivePath: 'assets/accessory-models/shaft-collar-d8/source-mesh-v2.json', skpSha256: 'f6d409729b1330eb9de4de3110907c5dd669a420caae8a00dce9732ab77b4d93', transformPolicy: 'source_xyz_mm_centered_only' },
    sourceFiles: {
      skpPath: 'assets/accessory-models/shaft-collar-d8/source/shaft-collar-d8.skp',
      skpStatus: 'retained_verified_reference',
      previewPath: 'assets/accessory-models/shaft-collar-d8/reference/shaft-collar-d8.png',
      cadPath: 'assets/accessory-models/shaft-collar-d8/cad/shaft-collar-d8-reference.dxf',
      cadFormat: 'DXF',
      cadStatus: 'reference_envelope_not_for_manufacture',
    },
    placement: visualPlacement([24.9895, 24.9833, 8]),
    pendingEvidence: ['source_mesh_origin_calibration', 'production_geometry_validation'],
  }),
  record({
    id: 'aluformula.shaft.support_sk8',
    revision: 'source-v2',
    catalogItemId: 'mengkaile.accessory.shaft_support_sk8',
    sceneTypes: ['shaft_support_sk8'],
    compatibleProfileIds: [],
    labels: { 'zh-CN': 'SK8 立式支撑座', en: 'SK8 upright support', ja: 'SK8 立形支持台' },
    dimensionsMm: [42, 32.8, 14],
    sceneDimensionsMm: [42, 32.8, 14],
    precisionPath: 'models/accessories/shaft-support-sk8/source-v2.glb',
    meshProvenance: 'direct_retained_skp_tessellation',
    sourceConversion: { archivePath: 'assets/accessory-models/shaft-support-sk8/source-mesh-v2.json', skpSha256: '08b65a917d4a043f2ff8bda7603003b12a70bdb467cd1101918659af691cba96', transformPolicy: 'source_xyz_mm_centered_only' },
    sourceFiles: {
      skpPath: 'assets/accessory-models/shaft-support-sk8/source/shaft-support-sk8.skp',
      skpStatus: 'retained_verified_reference',
      previewPath: null, // Legacy PNG depicts a different clamp; retained on disk, not trusted as an SK8 preview.
      cadPath: 'assets/accessory-models/shaft-support-sk8/cad/shaft-support-sk8-reference.dxf',
      cadFormat: 'DXF',
      cadStatus: 'reference_envelope_not_for_manufacture',
    },
    placement: visualPlacement([42, 32.8, 14]),
    pendingEvidence: ['source_mesh_origin_calibration', 'production_geometry_validation'],
  }),
  record({
    id: 'aluformula.shaft.support_shf8',
    revision: 'source-v2',
    catalogItemId: 'mengkaile.accessory.shaft_support_shf8',
    sceneTypes: ['shaft_support_shf8'],
    compatibleProfileIds: [],
    labels: { 'zh-CN': 'SHF8 卧式固定座', en: 'SHF8 flange support', ja: 'SHF8 フランジ支持台' },
    dimensionsMm: [43, 24, 10],
    sceneDimensionsMm: [43, 24, 10],
    precisionPath: 'models/accessories/shaft-support-shf8/source-v2.glb',
    meshProvenance: 'direct_retained_skp_tessellation',
    sourceConversion: { archivePath: 'assets/accessory-models/shaft-support-shf8/source-mesh-v2.json', skpSha256: '1f812be78149c96b919ca65ddec8595c2f0593276fae9b0dbccbef4c6cfbc54f', transformPolicy: 'source_xyz_mm_centered_only' },
    sourceFiles: {
      skpPath: 'assets/accessory-models/shaft-support-shf8/source/shaft-support-shf8.skp',
      skpStatus: 'retained_verified_reference',
      previewPath: null,
      cadPath: 'assets/accessory-models/shaft-support-shf8/cad/shaft-support-shf8-reference.dxf',
      cadFormat: 'DXF',
      cadStatus: 'reference_envelope_not_for_manufacture',
    },
    placement: visualPlacement([43, 24, 10]),
    pendingEvidence: ['source_mesh_origin_calibration', 'production_geometry_validation'],
  }),
  record({
    id: 'aluformula.connector.no1_2020',
    revision: 'precision-v1',
    catalogItemId: 'mengkaile.accessory.corner_bracket_no1',
    sceneTypes: ['connector'],
    compatibleProfileIds: ['2020'],
    labels: { 'zh-CN': '2020 压铸直角角件', en: '2020 die-cast right-angle bracket', ja: '2020 ダイカスト直角ブラケット' },
    dimensionsMm: [20, 28, 20],
    sceneDimensionsMm: [20, 28, 20],
    precisionPath: 'models/accessories/connector-no1-2020/precision-v1.glb',
    meshProvenance: 'aluformula_visual_reconstruction_from_existing_validator',
    sourceFiles: {
      skpPath: null,
      skpStatus: 'pending_supplier_or_calibrated_source',
      previewPath: 'public/images/accessory/1.svg',
      cadPath: 'assets/accessory-models/connector-no1-2020/cad/connector-no1-2020-reference.dxf',
      cadFormat: 'DXF',
      cadStatus: 'reference_envelope_not_for_manufacture',
    },
    placement: connectorPlacement('no1', 20),
    pendingEvidence: ['supplier_skp_or_scan', 'source_mesh_calibration', 'production_dimensions'],
  }),
  record({
    id: 'aluformula.connector.no1_3030',
    revision: 'precision-v1',
    catalogItemId: 'mengkaile.accessory.corner_bracket_no1',
    sceneTypes: ['connector'],
    compatibleProfileIds: ['3030'],
    labels: { 'zh-CN': '3030 压铸直角角件', en: '3030 die-cast right-angle bracket', ja: '3030 ダイカスト直角ブラケット' },
    dimensionsMm: [30, 30, 30],
    sceneDimensionsMm: [30, 30, 30],
    precisionPath: 'models/accessories/connector-no1-3030/precision-v1.glb',
    meshProvenance: 'aluformula_visual_reconstruction_from_existing_validator',
    sourceFiles: {
      skpPath: null,
      skpStatus: 'pending_supplier_or_calibrated_source',
      previewPath: 'public/images/accessory/1.svg',
      cadPath: 'assets/accessory-models/connector-no1-3030/cad/connector-no1-3030-reference.dxf',
      cadFormat: 'DXF',
      cadStatus: 'reference_envelope_not_for_manufacture',
    },
    placement: connectorPlacement('no1', 30),
    pendingEvidence: ['supplier_skp_or_scan', 'source_mesh_calibration', 'production_dimensions'],
  }),
  record({
    id: 'aluformula.connector.no5_2020',
    revision: 'precision-v1',
    catalogItemId: 'mengkaile.accessory.hidden_connector_no5',
    sceneTypes: ['hidden_connector'],
    compatibleProfileIds: ['2020'],
    labels: { 'zh-CN': '2020 隐藏式内置连接件', en: '2020 concealed internal connector', ja: '2020 隠し内蔵コネクタ' },
    dimensionsMm: [28, 28, 2.8],
    sceneDimensionsMm: [28, 8.4, 2.8],
    precisionPath: 'models/accessories/connector-no5-2020/precision-v1.glb',
    meshProvenance: 'aluformula_visual_reconstruction_from_existing_validator',
    sourceFiles: {
      skpPath: null,
      skpStatus: 'pending_supplier_or_calibrated_source',
      previewPath: 'public/images/accessory/5.svg',
      cadPath: 'assets/accessory-models/connector-no5-2020/cad/connector-no5-2020-reference.dxf',
      cadFormat: 'DXF',
      cadStatus: 'reference_envelope_not_for_manufacture',
    },
    placement: connectorPlacement('no5', 20),
    pendingEvidence: ['supplier_skp_or_scan', 'source_mesh_calibration', 'production_dimensions'],
  }),
  record({
    id: 'aluformula.connector.no5_3030',
    revision: 'precision-v1',
    catalogItemId: 'mengkaile.accessory.hidden_connector_no5',
    sceneTypes: ['hidden_connector'],
    compatibleProfileIds: ['3030'],
    labels: { 'zh-CN': '3030 隐藏式内置连接件', en: '3030 concealed internal connector', ja: '3030 隠し内蔵コネクタ' },
    dimensionsMm: [42, 42, 4.2],
    sceneDimensionsMm: [42, 12.6, 4.2],
    precisionPath: 'models/accessories/connector-no5-3030/precision-v1.glb',
    meshProvenance: 'aluformula_visual_reconstruction_from_existing_validator',
    sourceFiles: {
      skpPath: null,
      skpStatus: 'pending_supplier_or_calibrated_source',
      previewPath: 'public/images/accessory/5.svg',
      cadPath: 'assets/accessory-models/connector-no5-3030/cad/connector-no5-3030-reference.dxf',
      cadFormat: 'DXF',
      cadStatus: 'reference_envelope_not_for_manufacture',
    },
    placement: connectorPlacement('no5', 30),
    pendingEvidence: ['supplier_skp_or_scan', 'source_mesh_calibration', 'production_dimensions'],
  }),
  ...EXTRUDED_BRACKET_ASSETS,
  ...FLAT_PLATE_ASSETS,
  ...THREE_WAY_ASSETS,
] as const;

const SUPPLIER_SHAFT_REFERENCES: Partial<Record<AccessoryModelAssetId, NonNullable<AccessoryModelAssetRecord['precision']['supplierReference']>>> = {
  'aluformula.shaft.cross_clamp_d8': {
    productUrl: 'https://item.taobao.com/item.htm?id=596264324461', selectedSku: '8×8 同径双孔单螺栓',
    checkedDimensions: 'A41 / B15 / C15 / 两孔Ø8 / F13 / E5 / M4×10',
    estimatedDetails: ['槽宽、倒角、沉孔和螺钉头部比例未标注，按照片作展示估计'], referenceOnly: false,
    retainedSourceGlbPath: 'models/accessories/shaft-cross-clamp-d8/source-v2.glb',
    evidencePaths: ['assets/accessory-models/supplier-evidence-20260915/cross-photo.jpg', 'assets/accessory-models/supplier-evidence-20260915/cross-single-table.png'],
  },
  'aluformula.shaft.support_sk8': {
    productUrl: 'https://item.taobao.com/item.htm?id=596913543142', selectedSku: 'SK8 孔径8',
    checkedDimensions: 'W42 / F32.8 / L14 / h20 / G6 / P18 / B32 / S5.5 / 锁紧M4',
    estimatedDetails: ['槽宽、倒角、锁紧螺钉孔高度、沉孔及螺钉长度仅作展示估计'], referenceOnly: false,
    retainedSourceGlbPath: 'models/accessories/shaft-support-sk8/source-v2.glb',
    evidencePaths: ['assets/accessory-models/supplier-evidence-20260915/sk8-photo.jpg', 'assets/accessory-models/supplier-evidence-20260915/sk8-table.png'],
  },
  'aluformula.shaft.collar_d8': {
    productUrl: 'https://item.taobao.com/item.htm?id=596200272042', selectedSku: '铝-SCS8MM 内8×外25×厚8',
    checkedDimensions: '内Ø8 / 外Ø25 / 厚8；画布保留旧模型包络24.9895×24.9833×8',
    estimatedDetails: ['开口宽度、对侧卸荷槽和锁紧螺钉型号/孔位未标注，按照片作展示估计'], referenceOnly: false,
    retainedSourceGlbPath: 'models/accessories/shaft-collar-d8/source-v2.glb',
    evidencePaths: ['assets/accessory-models/supplier-evidence-20260915/collar-family-photo.webp'],
  },
};

/** Only the rendering revision changes; SKU, datum, dimensions and release gates do not. */
export const ACCESSORY_MODEL_ASSETS: readonly AccessoryModelAssetRecord[] = RETAINED_ACCESSORY_MODEL_ASSETS.map(asset => {
  const supplierReference = SUPPLIER_SHAFT_REFERENCES[asset.id];
  if (!supplierReference) return asset;
  return {
    ...asset, revision: 'vendor-visual-v3',
    precision: { ...asset.precision, sourceConversion: undefined, supplierReference,
      meshProvenance: 'supplier_drawing_and_photo_visual_reconstruction',
      glbPublicPath: asset.precision.glbPublicPath.replace('source-v2.glb', 'vendor-visual-v3.glb') },
    pendingEvidence: [...asset.pendingEvidence, 'supplier_unmarked_details_and_fastener_calibration'],
  };
});

/** Read-only evidence previews. Deliberately NOT registered as insertable scene/catalog items. */
export const SHAFT_REFERENCE_MODEL_ASSETS = [
  record({ id: 'aluformula.shaft.reference_parallel_d8', revision: 'vendor-visual-v3',
    catalogItemId: 'reference-only.parallel-d8', sceneTypes: [], compatibleProfileIds: [],
    labels: { 'zh-CN': 'Ø8 双孔平行固定夹 · 实物参考', en: 'Ø8 parallel clamp · reference', ja: 'Ø8 平行クランプ・参考' },
    dimensionsMm: [15, 41, 15], sceneDimensionsMm: [15, 41, 15],
    precisionPath: 'models/accessories/shaft-parallel-clamp-d8/vendor-visual-v3.glb',
    meshProvenance: 'supplier_drawing_and_photo_visual_reconstruction',
    supplierReference: { productUrl: 'https://item.taobao.com/item.htm?id=623056004863', selectedSku: '8×8 单螺栓 长41',
      checkedDimensions: '长41 / 截面15×15 / 两孔Ø8 / 孔距F15 / E5 / M4×10',
      estimatedDetails: ['槽宽、倒角、沉孔和螺钉头部比例仅为展示估计'], referenceOnly: true, retainedSourceGlbPath: null,
      evidencePaths: ['assets/accessory-models/supplier-evidence-20260915/parallel-photo.jpg', 'assets/accessory-models/supplier-evidence-20260915/parallel-table.jpg'] },
    sourceFiles: { skpPath: null, skpStatus: 'pending_supplier_or_calibrated_source', previewPath: null, cadPath: null, cadFormat: 'DXF', cadStatus: 'pending' },
    placement: visualPlacement([15, 41, 15]), pendingEvidence: ['supplier_skp_or_scan', 'installation_datum_and_clearance', 'production_geometry_validation'],
  }),
  record({ id: 'aluformula.shaft.reference_t_d8', revision: 'vendor-visual-v3',
    catalogItemId: 'reference-only.t-d8', sceneTypes: [], compatibleProfileIds: [],
    labels: { 'zh-CN': 'Ø8 T型支柱固定夹 · 实物参考', en: 'Ø8 T-junction clamp · reference', ja: 'Ø8 T形クランプ・参考' },
    dimensionsMm: [15, 40, 15], sceneDimensionsMm: [15, 40, 15],
    precisionPath: 'models/accessories/shaft-t-clamp-d8/vendor-visual-v3.glb',
    meshProvenance: 'supplier_drawing_and_photo_visual_reconstruction',
    supplierReference: { productUrl: 'https://item.taobao.com/item.htm?id=639861451196', selectedSku: 'T型8-8',
      checkedDimensions: '外形15×15×40 / 两孔Ø8 / 轴向孔深15',
      estimatedDetails: ['两孔中心坐标、槽宽、锁紧螺纹/孔位、沉孔、螺钉头部及倒角为照片估计；不得作为加工尺寸'], referenceOnly: true, retainedSourceGlbPath: null,
      evidencePaths: ['assets/accessory-models/supplier-evidence-20260915/t-family-photo.webp', 'assets/accessory-models/supplier-evidence-20260915/t-table.png'] },
    sourceFiles: { skpPath: null, skpStatus: 'pending_supplier_or_calibrated_source', previewPath: null, cadPath: null, cadFormat: 'DXF', cadStatus: 'pending' },
    placement: visualPlacement([15, 40, 15]), pendingEvidence: ['supplier_skp_or_scan', 'hole_center_and_fastener_dimensions', 'installation_datum_and_clearance', 'production_geometry_validation'],
  }),
] as const;

export const getShaftReferenceModelAsset = (gapId: string): AccessoryModelAssetRecord | null => (
  gapId === 'gap.parallel_double_hole_clamp' ? SHAFT_REFERENCE_MODEL_ASSETS[0]
    : gapId === 'gap.t_post_clamp' ? SHAFT_REFERENCE_MODEL_ASSETS[1] : null
);

export const getAccessoryModelThumbnailPath = (asset: AccessoryModelAssetRecord): string => `/${asset.precision.glbPublicPath.replace(/[^/]+\.glb$/, `thumbnail-${asset.revision}.${asset.revision === 'source-v2' ? 'webp' : 'png'}`)}`;

const bySceneType = new Map<string, AccessoryModelAssetRecord>();
const byCatalogItemId = new Map<string, AccessoryModelAssetRecord[]>();

ACCESSORY_MODEL_ASSETS.forEach((asset) => {
  const catalogVariants = byCatalogItemId.get(asset.catalogItemId) || [];
  if (catalogVariants.some((candidate) => candidate.compatibleProfileIds.some((profileId) => asset.compatibleProfileIds.includes(profileId)))) {
    throw new Error(`Duplicate accessory asset catalog/profile identity: ${asset.catalogItemId}`);
  }
  byCatalogItemId.set(asset.catalogItemId, [...catalogVariants, asset]);
  asset.sceneTypes.forEach((sceneType) => {
    const sceneKey = `${sceneType}:${asset.compatibleProfileIds.join(',') || '*'}`;
    if (bySceneType.has(sceneKey)) throw new Error(`Duplicate accessory asset scene/profile identity: ${sceneKey}`);
    bySceneType.set(sceneKey, asset);
  });
});

export const getAccessoryModelAsset = (input: {
  shelfSupportType?: string;
  catalogItemId?: string;
  kind?: string;
  accessoryProfileSize?: string;
}) => (
  getAccessoryModelAssets(input).find((asset) => (
    !asset.compatibleProfileIds.length
    || (Boolean(input.accessoryProfileSize) && asset.compatibleProfileIds.includes(input.accessoryProfileSize!))
  )) || null
);

export const getAccessoryModelAssets = (input: {
  shelfSupportType?: string;
  catalogItemId?: string;
  kind?: string;
  accessoryProfileSize?: string;
}) => {
  const sceneType = input.shelfSupportType || input.kind;
  const candidates = input.catalogItemId
    ? byCatalogItemId.get(input.catalogItemId) || []
    : sceneType
      ? ACCESSORY_MODEL_ASSETS.filter((asset) => asset.sceneTypes.includes(sceneType))
      : [];
  if (!input.accessoryProfileSize) return candidates;
  return candidates.filter((asset) => (
    !asset.compatibleProfileIds.length || asset.compatibleProfileIds.includes(input.accessoryProfileSize!)
  ));
};

export const hasPrecisionAccessoryModel = (input: {
  shelfSupportType?: string;
  catalogItemId?: string;
  kind?: string;
  accessoryProfileSize?: string;
}) => Boolean(getAccessoryModelAsset(input)?.precision.state === 'available');
