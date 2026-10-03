import type { ParametricSceneItem, ParametricTemplatePayload } from './parametricFurniture';
import type { ImportedSourceMesh } from './importedSourceMesh';
import type { DrillHole } from '../types';
import { prepareStoolConnectionStructure } from './stoolConnections';
import { markStoolAccessoryMesh, resolveStoolAccessoryReference } from './stoolAccessoryAssets';
import { refineStoolSourceAssembly, STOOL_ASSEMBLY_MEASUREMENTS } from './stoolAssemblyRefinements';

export interface StoolParameters { widthMm: number; depthMm: number; heightMm: number }
export const STOOL_BASELINE: StoolParameters = { widthMm: 360, depthMm: 360, heightMm: 500 };
/** Supported design range; not a load, stability or manufacturing certification. */
export const STOOL_LIMITS = {
  widthMm: { min: 360, max: 600, step: 1 },
  depthMm: { min: 360, max: 600, step: 1 },
  heightMm: { min: 500, max: 800, step: 1 },
} as const;
export const STOOL_SOURCE_SHA256 = 'c8dcb2a4f1c9f452b87225a1e98c34323cb75a6b14bd92db7e97f52b27ab0166';
export const STOOL_GROUND_OFFSET_MM = 61.15893872280715;
const round = (n: number) => Number(n.toFixed(6));
type Vector = [number, number, number];
type PartType = 'shaft' | 'shaft_support' | 'fixed_support' | 'three_way' | 'angle_bracket' | 'caster' | 'handle' | 'decorative_profile';
export interface StoolSourceInstance {
  id: string; name: string; type: PartType; sourcePath: string; meshId: string;
  position: Vector; rotation: Vector; source: ImportedSourceMesh['source']; dimensionsMm: Vector;
  lengthAxis?: 0 | 1 | 2; worldAxis?: 0 | 2;
}
export interface StoolSourceAsset {
  schemaVersion: 1; sourceSha256: string; coordinateSystem: 'local-mm-y-up';
  meshes: Record<string, ImportedSourceMesh>;
  instances: StoolSourceInstance[];
  nativeParts: (Pick<ParametricSceneItem, 'id' | 'kind' | 'name' | 'position' | 'rotation'> & {
    sourcePath: string; sourceItemId?: string; variantId?: string; length?: number; width?: number; height?: number; thickness?: number;
    holes?: DrillHole[]; tappingLeft?: boolean; tappingRight?: boolean;
  })[];
}
export interface StoolLayout extends StoolParameters {
  boardWidthMm: number; boardDepthMm: number; boardThicknessMm: number;
  overallWidthMm: number; overallDepthMm: number; overallHeightMm: number;
  profileLengthMm: number; decorativeProfileLengthMm: number;
  counts: { profiles: number; panels: number; shafts: number; supports: number; fixedSupports: number; threeWay: number; brackets: number; casters: number; handles: number; decorations: number; total: number };
}
export const calculateStoolLayout = (parameters: StoolParameters): StoolLayout => ({
  ...parameters,
  boardWidthMm: round(parameters.widthMm - 60), boardDepthMm: round(parameters.depthMm - 60), boardThicknessMm: 18,
  overallWidthMm: round(parameters.widthMm + 39.65204513941535),
  overallDepthMm: round(parameters.depthMm + STOOL_ASSEMBLY_MEASUREMENTS.overallDepthBeyondFrameMm),
  overallHeightMm: round(parameters.heightMm + STOOL_GROUND_OFFSET_MM),
  profileLengthMm: round(8400 + 10 * (parameters.widthMm - 360) + 10 * (parameters.depthMm - 360) + 4 * (parameters.heightMm - 500)),
  decorativeProfileLengthMm: 240,
  // Connector and fastener totals are determined by the physical node solver.
  counts: { profiles: 32, panels: 2, shafts: 4, supports: 8, fixedSupports: 16, threeWay: 0, brackets: 0, casters: 4, handles: 1, decorations: 8, total: 75 },
});
export const validateStoolParameters = (parameters: StoolParameters): { valid: boolean; message: string; layout?: StoolLayout } => {
  for (const key of Object.keys(STOOL_LIMITS) as (keyof StoolParameters)[]) {
    const value = parameters[key]; const limit = STOOL_LIMITS[key];
    if (!Number.isFinite(value) || value < limit.min || value > limit.max) {
      const label = key === 'widthMm' ? '主体宽度' : key === 'depthMm' ? '主体深度' : '主体高度';
      return { valid: false, message: `${label}须在 ${limit.min}–${limit.max} mm 范围内。` };
    }
  }
  return { valid: true, message: '可生成设计草案', layout: calculateStoolLayout(parameters) };
};

let assetPromise: Promise<StoolSourceAsset> | undefined;
export const loadStoolSourceAsset = (): Promise<StoolSourceAsset> => {
  assetPromise ??= fetch(`${import.meta.env.BASE_URL}models/stool/source-v1.json`).then(async (response) => {
    if (!response.ok) throw new Error('凳子原模型资源加载失败，请稍后重试。');
    const asset = await response.json() as StoolSourceAsset;
    if (asset.schemaVersion !== 1 || asset.sourceSha256 !== STOOL_SOURCE_SHA256
      || asset.coordinateSystem !== 'local-mm-y-up' || asset.nativeParts?.length !== 34 || asset.instances?.length !== 69) {
      throw new Error('凳子源模型版本或构件数量不匹配。');
    }
    return asset;
  }).catch((error) => { assetPromise = undefined; throw error; });
  return assetPromise;
};

const translateSide = (value: number, delta: number) => Math.abs(value) < 0.01 ? value : value + Math.sign(value) * delta / 2;
/** Three decorative openings are distributed equally; the 30mm dividers and 80mm inserts remain rigid. */
const decorativeAnchor = (value: number, delta: number, divisor: number) => Math.abs(value) < 0.01 ? value : value + Math.sign(value) * delta / divisor;

function moveRigidPart(part: StoolSourceInstance, dw: number, dd: number, dh: number): Vector {
  const [x, y, z] = part.position;
  let nx = x; let nz = z;
  if (part.type === 'handle') {
    nz = translateSide(z, dd);
  } else if (part.type === 'decorative_profile') {
    // The outside face stays on its side frame. The insertion stays centred
    // in one of the two outer openings of that side's three-opening band.
    const onXSide = Math.abs(x) > 145;
    nx = decorativeAnchor(x, dw, onXSide ? 2 : 3);
    nz = decorativeAnchor(z, dd, onXSide ? 3 : 2);
  } else if (part.type === 'angle_bracket') {
    // These brackets seat either against a corner post (outer anchor) or
    // the short divider (one-sixth anchor). Keep their installation offsets.
    nx = decorativeAnchor(x, dw, Math.abs(x) > 90 ? 2 : 6);
    nz = decorativeAnchor(z, dd, Math.abs(z) > 90 ? 2 : 6);
  } else if (part.type === 'shaft') {
    // A shaft grows along its actual direction, without changing its bore.
    if (part.worldAxis === 0) nz = translateSide(z, dd);
    else nx = translateSide(x, dw);
  } else {
    nx = translateSide(x, dw); nz = translateSide(z, dd);
  }
  return [round(nx), round(y + (y > 250 ? dh : 0) + STOOL_GROUND_OFFSET_MM), round(nz)];
}

function stretchShaft(mesh: ImportedSourceMesh, part: StoolSourceInstance, delta: number): ImportedSourceMesh {
  if (delta === 0) return { ...mesh, source: part.source };
  if (part.lengthAxis === undefined || part.worldAxis === undefined) throw new Error('源光轴方向资料缺失。');
  const axis = part.lengthAxis;
  const originalLength = mesh.boundsMm.max[axis] - mesh.boundsMm.min[axis];
  const factor = (originalLength + delta) / originalLength;
  const center = (mesh.boundsMm.max[axis] + mesh.boundsMm.min[axis]) / 2;
  const positionsMm = mesh.positionsMm.map((value, index) => index % 3 === axis ? round(center + (value - center) * factor) : value);
  const min = [...mesh.boundsMm.min] as Vector; const max = [...mesh.boundsMm.max] as Vector;
  min[axis] = round(center + (min[axis] - center) * factor); max[axis] = round(center + (max[axis] - center) * factor);
  // Recompute normals from the resized source triangles in the renderer.
  const { normals: _normals, ...rest } = mesh;
  return { ...rest, source: { ...part.source, dimensionsMm: { ...part.source.dimensionsMm, length: round(originalLength + delta) } }, positionsMm, boundsMm: { min, max } };
}

/** Exact archived source arrangement, retained for source evidence and regression checks. */
export function buildStoolSourceTemplateFromAsset(parameters: StoolParameters, asset: StoolSourceAsset): ParametricTemplatePayload {
  const validation = validateStoolParameters(parameters);
  if (!validation.valid || !validation.layout) throw new Error(validation.message);
  if (asset.sourceSha256 !== STOOL_SOURCE_SHA256 || asset.nativeParts.length !== 34 || asset.instances.length !== 69) throw new Error('凳子源模型构件不完整。');
  const dw = parameters.widthMm - 360; const dd = parameters.depthMm - 360; const dh = parameters.heightMm - 500;
  const sourceIds = new Map<string, string>();
  for (const part of asset.nativeParts) {
    if (part.sourceItemId && asset.nativeParts.filter((candidate) => candidate.sourceItemId === part.sourceItemId).length === 1) {
      sourceIds.set(part.sourceItemId, `parametric-stool-${part.id}`);
    }
  }
  const items: ParametricSceneItem[] = asset.nativeParts.map((part) => {
    const [x, y, z] = part.position;
    const isLeg = part.kind === 'profile' && Math.abs((part.length || 0) - 410) < 0.01;
    const isDivider = part.kind === 'profile' && Math.abs((part.length || 0) - 80) < 0.01;
    const isBoard = part.kind === 'marine_board';
    // Profile local X is its cut axis; the archived orthogonal rotation is retained.
    const [rx, ry, rz] = part.rotation.map((n) => n * Math.PI / 180);
    const localXWorldZ = Math.sin(rx) * Math.sin(rz) - Math.cos(rx) * Math.sin(ry) * Math.cos(rz);
    const alongDepth = Math.abs(localXWorldZ) > 0.5;
    let nx = isBoard ? x : translateSide(x, dw);
    let nz = isBoard ? z : translateSide(z, dd);
    if (isDivider) {
      nx = decorativeAnchor(x, dw, Math.abs(x) > 145 ? 2 : 6);
      nz = decorativeAnchor(z, dd, Math.abs(z) > 145 ? 2 : 6);
    }
    const item: ParametricSceneItem = {
      id: `parametric-stool-${part.id}`, kind: part.kind, name: part.name,
      position: [round(nx), round(y + (isLeg ? dh / 2 : y > 250 ? dh : 0) + STOOL_GROUND_OFFSET_MM), round(nz)],
      rotation: [...part.rotation], quantity: 1, colorId: isBoard ? 'wood_natural' : 'natural',
      remark: `凳子.skp｜${part.sourcePath}｜原模型尺寸驱动的结构草案；连接、固定方式与承载待复核。`,
    };
    if (isBoard) {
      // The source boards are rolled 90°: their local width lies along world
      // depth. Preserve that basis when applying an asymmetric width/depth edit.
      Object.assign(item, { width: round((part.width || 300) + (alongDepth ? dd : dw)), height: round((part.height || 300) + (alongDepth ? dw : dd)), thickness: 18 });
    } else {
      const deltaLength = isLeg ? dh : isDivider ? 0 : alongDepth ? dd : dw;
      const holes = (part.holes || []).map((hole) => ({
        ...hole, id: `parametric-stool-${hole.id}`,
        // Source 95/205mm holes follow the two short dividers, not a uniform
        // scaling of the hole's end distance. Four 315mm leg holes follow the upper band.
        positionMm: round(hole.positionMm + (isLeg ? dh : hole.positionMm === 95 ? deltaLength / 3 : hole.positionMm === 205 ? deltaLength * 2 / 3 : 0)),
        ...(hole.jointKey ? { jointKey: hole.jointKey.split(':').map((token) => sourceIds.get(token) || token).join(':') } : {}),
      }));
      Object.assign(item, { variantId: '3030', length: round((part.length || 0) + deltaLength), holes,
        tappingLeft: Boolean(part.tappingLeft), tappingRight: Boolean(part.tappingRight) });
    }
    return item;
  });
  for (const part of asset.instances) {
    const mesh = asset.meshes[part.meshId];
    if (!mesh) throw new Error(`凳子源配件网格缺失：${part.id}`);
    const sourceMesh = part.type === 'shaft'
      ? stretchShaft(mesh, part, part.worldAxis === 0 ? dw : dd)
      : { ...mesh, source: part.source };
    items.push({
      id: `parametric-stool-${part.id}`, kind: 'imported_component', name: part.name,
      position: moveRigidPart(part, dw, dd, dh), rotation: [...part.rotation], colorId: 'natural', quantity: 1, sourceMesh,
      remark: `凳子.skp 原组件｜${part.sourcePath}｜${part.type === 'shaft' ? 'Ø12保持不变，仅沿轴改变长度' : '原网格刚性摆放，未缩放'}；目录型号、价格及安装关系待核。`,
    });
  }
  const length = items.reduce((sum, item) => sum + (item.kind === 'profile' ? item.length || 0 : 0), 0);
  if (items.length !== 103 || Math.abs(length - (validation.layout.profileLengthMm - 360)) > 0.01 || new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error('凳子结构数量或型材长度校验失败。');
  }
  return {
    schemaVersion: 1, source: 'parametric_stool', createdAt: new Date().toISOString(), items,
    summary: {
      template: 'SU_STOOL_20260930', sourceFile: '凳子.skp', sourceSha256: STOOL_SOURCE_SHA256,
      ...parameters, totalCount: items.length, profileCount: 32, panelCount: 2,
      profileLengthMm: length, boardThicknessMm: 18, casterGroundOffsetMm: STOOL_GROUND_OFFSET_MM,
      designStatus: '源模型参数化草案；固定、运动、承载、加工与报价待核',
    },
  };
}

/** Closed structural frames ready for the designer's validated No.5/drill adapter. */
export function buildStoolTemplateFromAsset(parameters: StoolParameters, asset: StoolSourceAsset): ParametricTemplatePayload {
  const source = buildStoolSourceTemplateFromAsset(parameters, asset);
  const prepared = refineStoolSourceAssembly(prepareStoolConnectionStructure(source.items), parameters);
  const items = prepared.map(item => {
    if (!item.sourceMesh) return item;
    const sourceMesh = markStoolAccessoryMesh(item.sourceMesh);
    const partCatalogRef = resolveStoolAccessoryReference(sourceMesh);
    return { ...item, sourceMesh, ...(partCatalogRef ? { partCatalogRef, name: sourceMesh.source.componentName || item.name } : {}) };
  });
  return { ...source, items, summary: { ...source.summary, totalCount: items.length,
    profileLengthMm: items.reduce((sum, item) => sum + (item.kind === 'profile' ? item.length || 0 : 0), 0),
    connectionPolicy: 'No.5隐形角码优先，其次打孔攻丝；按真实接触节点复核',
    designStatus: '连接优化设计；独立配件与运动机构按原模型保留，采购与承载待核',
  } };
}

export async function buildStoolTemplate(parameters: StoolParameters = STOOL_BASELINE): Promise<ParametricTemplatePayload> {
  const validation = validateStoolParameters(parameters);
  if (!validation.valid) throw new Error(validation.message);
  return buildStoolTemplateFromAsset(parameters, await loadStoolSourceAsset());
}
