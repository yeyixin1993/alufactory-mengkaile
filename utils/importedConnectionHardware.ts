import { Euler, Quaternion, Vector3 } from 'three';
import { getAccessoryModelAsset } from '../data/accessoryModelAssets';
import { COMMON_ACCESSORY_CATALOG } from '../data/designerModelCatalog';

type V3 = [number, number, number];
type Series = '2020' | '3030';
export interface ImportedNo1HardwareItem {
  id?: string;
  kind?: string;
  accessoryProfileSize?: string;
  position?: readonly number[];
  rotation?: readonly number[];
  quantity?: number;
  importedConnectionDraft?: unknown;
}
export interface ImportedHardwareCatalogCandidate {
  catalogId: string;
  name: string;
  threadSize: string;
  lengthMm: number | null;
  fitStatus: 'unverified';
  source: 'data/designerModelCatalog.ts#COMMON_ACCESSORY_CATALOG';
}
export interface ImportedConnectionHardwareLine {
  role: 'screw' | 't_slot_nut';
  label: string;
  proposedQuantity: number;
  quantityBasis: 'one_per_visual_fastener_axis';
  includedInBracketPackage: 'catalog_label_says_included' | 'unknown';
  selectedCatalogId: null;
  selectedThreadSize: null;
  selectedLengthMm: null;
  catalogCandidates: ImportedHardwareCatalogCandidate[];
}
export interface ImportedConnectionHardware {
  schemaVersion: 1;
  type: 'no1_hardware_checklist';
  profileSeries: Series;
  reviewStatus: 'needs_review';
  productionReady: false;
  procurementReady: false;
  bracketCatalogId: 'mengkaile.accessory.corner_bracket_no1';
  assetId: string;
  assetRevision: string;
  bracketPose: { position: V3; rotation: V3 };
  package: {
    catalogLabel: string;
    screwInclusionEvidence: 'catalog_label_only';
    tNutInclusionEvidence: 'unknown';
    confirmedPackageQuantity: null;
    existingVisualScrewCount: number;
    existingVisualScrewsAreSceneItems: false;
    separateFastenerBomAllowed: false;
    reason: string;
  };
  lines: ImportedConnectionHardwareLine[];
  anchors: {
    id: string;
    localPositionMm: V3;
    worldPositionMm: V3;
    worldOutwardNormal: V3;
    suggestedInsertionDirection: V3;
    evidence: 'visual_reference';
    mountingConfirmed: false;
  }[];
  /** Deliberately empty until actual No.1/T-slot/fastener fit evidence exists. */
  extraEntities: never[];
  missingEvidence: { code: string; message: string }[];
  sources: { path: string; meaning: string }[];
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finitePose = (value: unknown): value is V3 => Array.isArray(value) && value.length === 3
  && value.every((number) => typeof number === 'number' && Number.isFinite(number) && Math.abs(number) <= 100_000_000);
const tuple = (value: readonly number[]): V3 => [value[0], value[1], value[2]];
const roundedTuple = (vector: Vector3): V3 => vector.toArray().map((number) => Number(number.toFixed(8))) as V3;
const SERIES: readonly string[] = ['2020', '3030'];

function catalogCandidates(series: Series, role: 'screw' | 't_slot_nut'): ImportedHardwareCatalogCandidate[] {
  // These are stock-directory options, not the unrelated direct-lock M6/M8
  // rule catalog. No head/thread/length option is selected merely by series.
  return COMMON_ACCESSORY_CATALOG.filter((entry) => entry.categoryId === 'fastener'
    && entry.compatibleProfileIds.includes(series)
    && (role === 'screw' ? entry.id.endsWith('_cap') : entry.id.endsWith('_tnut')))
    .map((entry) => {
      const thread = entry.name.match(/\b(M\d+)/i)?.[1].toUpperCase() || '';
      const length = role === 'screw' ? entry.name.match(/M\d+\s*[*×]\s*(\d+(?:\.\d+)?)/i)?.[1] : undefined;
      return { catalogId: entry.id, name: entry.name, threadSize: thread, lengthMm: length ? Number(length) : null,
        fitStatus: 'unverified', source: 'data/designerModelCatalog.ts#COMMON_ACCESSORY_CATALOG' };
    });
}

/** Price-free checklist for the exact two supported No.1 variants; no scene edits. */
export function describeImportedNo1Hardware(item: ImportedNo1HardwareItem): ImportedConnectionHardware | null {
  if (item.kind !== 'connector' || !SERIES.includes(item.accessoryProfileSize || '')
    || !finitePose(item.position) || !finitePose(item.rotation)) return null;
  const series = item.accessoryProfileSize as Series;
  const asset = getAccessoryModelAsset({ kind: 'connector', accessoryProfileSize: series });
  if (!asset || asset.catalogItemId !== 'mengkaile.accessory.corner_bracket_no1') return null;
  const fastenerAxes = asset.placement.anchors.filter((anchor) => anchor.role === 'fastener_axis');
  // A registry change must not silently convert an uncertain source template
  // into a new hole count or a production-approved mounting scheme.
  if (fastenerAxes.length !== 2) return null;
  const q = new Quaternion().setFromEuler(new Euler(...item.rotation.map((angle) => angle * Math.PI / 180) as V3, 'XYZ'));
  const offset = new Vector3(...item.position);
  const quantity = fastenerAxes.length;
  const catalogLabel = COMMON_ACCESSORY_CATALOG.find((entry) => entry.id === '1')?.name || '';
  return {
    schemaVersion: 1, type: 'no1_hardware_checklist', profileSeries: series, reviewStatus: 'needs_review',
    productionReady: false, procurementReady: false, bracketCatalogId: 'mengkaile.accessory.corner_bracket_no1',
    assetId: asset.id, assetRevision: asset.revision,
    bracketPose: { position: tuple(item.position), rotation: tuple(item.rotation) },
    package: {
      catalogLabel, screwInclusionEvidence: 'catalog_label_only', tNutInclusionEvidence: 'unknown', confirmedPackageQuantity: null,
      existingVisualScrewCount: quantity, existingVisualScrewsAreSceneItems: false, separateFastenerBomAllowed: false,
      reason: '角码目录标注配螺丝，简模与精模均已有两处螺丝示意。示意不等于已确认实物规格；此清单不再生成螺丝实体，也不追加独立采购行。',
    },
    lines: [
      { role: 'screw', label: '螺丝×2（角码套餐标注已含，实物规格待核）', proposedQuantity: quantity,
        quantityBasis: 'one_per_visual_fastener_axis', includedInBracketPackage: 'catalog_label_says_included',
        selectedCatalogId: null, selectedThreadSize: null, selectedLengthMm: null, catalogCandidates: catalogCandidates(series, 'screw') },
      { role: 't_slot_nut', label: 'T母×2（是否套餐内含、槽规格待核）', proposedQuantity: quantity,
        quantityBasis: 'one_per_visual_fastener_axis', includedInBracketPackage: 'unknown',
        selectedCatalogId: null, selectedThreadSize: null, selectedLengthMm: null, catalogCandidates: catalogCandidates(series, 't_slot_nut') },
    ],
    anchors: fastenerAxes.map((anchor) => {
      const outward = new Vector3(...anchor.normal).applyQuaternion(q).normalize();
      return { id: anchor.id, localPositionMm: tuple(anchor.positionMm),
        worldPositionMm: roundedTuple(new Vector3(...anchor.positionMm).applyQuaternion(q).add(offset)),
        worldOutwardNormal: roundedTuple(outward), suggestedInsertionDirection: roundedTuple(outward.clone().negate()),
        evidence: 'visual_reference', mountingConfirmed: false };
    }),
    extraEntities: [],
    missingEvidence: [
      { code: 'no1_production_drawing_missing', message: 'No.1 当前为视觉重建；角码真实孔径、孔心、壁厚与头部承压面须对照实物图纸。' },
      { code: 'source_slot_fit_unverified', message: '源型材的槽宽、槽腔深度、槽唇及标准尚未与槽用螺母尺寸建立对应，不能只按2020/3030选定。' },
      { code: 'fastener_length_unselected', message: '螺纹及长度只是库存备选；尚缺板厚叠加、螺母有效啮合与槽底余量，不能套用直锁M6×30/M8×45。' },
      { code: 'package_contents_unconfirmed', message: '两螺丝、两T母为按双安装面推导的方案数量；须确认角码套餐实际包含数量及是否含槽用螺母后再采购。' },
      { code: 'tool_and_installation_unverified', message: '工具入口、螺母装入方式、拧紧扭矩及安装顺序仍待实物复核。' },
    ],
    sources: [
      { path: 'data/designerModelCatalog.ts#COMMON_ACCESSORY_CATALOG', meaning: 'No.1配螺丝标签和同系列库存备选；不是已验证配套关系。' },
      { path: 'alufactory-backend/app/accessory_inventory.py#ACCESSORY_CATALOG', meaning: '对应库存目录身份；不读取库存价格或据此下单。' },
      { path: `data/accessoryModelAssets.ts#${asset.id}`, meaning: `双安装轴与视觉包络（${asset.revision}）；生产尺寸及源网格校准仍待核。` },
      { path: 'components/DIYDesigner.tsx#connector-renderer', meaning: '简模包含两处accessoryDecoration螺丝头，未单独计入场景构件。' },
      { path: 'scripts/build-precision-accessory-assets.ts#buildNo1', meaning: '精模包含horizontal-fastener和vertical-fastener两组示意，不可再叠加假实体。' },
    ],
  };
}

// The expected tree is tiny and bounded. Comparing its exact structure rejects
// unknown approval/specification fields without recursively walking an arbitrary
// untrusted object or serializing textures / whole source meshes.
function sameContract(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length
    && expected.every((entry, index) => sameContract(actual[index], entry));
  if (record(expected)) return record(actual) && Object.keys(actual).length === Object.keys(expected).length
    && Object.keys(expected).every((key) => Object.prototype.hasOwnProperty.call(actual, key) && sameContract(actual[key], expected[key]));
  return actual === expected;
}

/** Strict schema-v1 reader. Saved metadata cannot upgrade uncertain evidence. */
export function validateImportedConnectionHardware(value: unknown): string[] {
  if (!record(value)) return ['角码紧固件清单必须为对象。'];
  if (value.schemaVersion !== 1 || value.type !== 'no1_hardware_checklist') return ['角码紧固件清单版本或类别不正确。'];
  if (value.reviewStatus !== 'needs_review' || value.productionReady !== false || value.procurementReady !== false) {
    return ['角码紧固件清单只能保持待核，不能导入制造或采购已通过状态。'];
  }
  if (typeof value.profileSeries !== 'string' || !SERIES.includes(value.profileSeries)) return ['紧固件清单只支持已登记的2020/3030 No.1角码。'];
  if (!record(value.bracketPose) || !finitePose(value.bracketPose.position) || !finitePose(value.bracketPose.rotation)) {
    return ['紧固件清单的角码位姿必须为有限的三维数值。'];
  }
  const expected = describeImportedNo1Hardware({ kind: 'connector', accessoryProfileSize: value.profileSeries,
    position: value.bracketPose.position, rotation: value.bracketPose.rotation });
  if (!expected || !sameContract(value, expected)) return ['紧固件清单与当前视觉参考及目录合同不一致；不得锁定无依据的螺纹、长度、孔位、采购数量或新增实体。'];
  return [];
}

export interface ImportedNo1HardwareSummary {
  bracketCount: number;
  includedScrewReferenceCount: number;
  tNutQuantityToConfirm: number;
  additionalEntityCount: 0;
  purchaseReady: false;
  duplicateItemIds: string[];
  unresolvedItemIds: string[];
  lines: { profileSeries: Series; bracketCount: number; screwReferenceCount: number; tNutQuantityToConfirm: number }[];
  note: string;
}

/** Deduplicate actual draft IDs; this is a review count, not a purchase BOM. */
export function summarizeImportedNo1Hardware(items: readonly ImportedNo1HardwareItem[]): ImportedNo1HardwareSummary {
  const seen = new Set<string>(); const duplicates = new Set<string>(); const unresolved = new Set<string>();
  const totals = new Map<Series, { profileSeries: Series; bracketCount: number; screwReferenceCount: number; tNutQuantityToConfirm: number }>();
  for (const item of items) {
    if (!record(item.importedConnectionDraft) || item.importedConnectionDraft.method !== 'corner_bracket') continue;
    if (!item.id?.trim()) { unresolved.add('(missing-id)'); continue; }
    if (seen.has(item.id)) { duplicates.add(item.id); continue; } seen.add(item.id);
    const report = describeImportedNo1Hardware(item);
    if (!report || (item.quantity !== undefined && item.quantity !== 1)) { unresolved.add(item.id); continue; }
    const row = totals.get(report.profileSeries) || { profileSeries: report.profileSeries, bracketCount: 0, screwReferenceCount: 0, tNutQuantityToConfirm: 0 };
    row.bracketCount += 1; row.screwReferenceCount += 2; row.tNutQuantityToConfirm += 2; totals.set(report.profileSeries, row);
  }
  const lines = [...totals.values()].sort((a, b) => a.profileSeries.localeCompare(b.profileSeries));
  return { bracketCount: lines.reduce((sum, row) => sum + row.bracketCount, 0),
    includedScrewReferenceCount: lines.reduce((sum, row) => sum + row.screwReferenceCount, 0),
    tNutQuantityToConfirm: lines.reduce((sum, row) => sum + row.tNutQuantityToConfirm, 0), additionalEntityCount: 0, purchaseReady: false,
    duplicateItemIds: [...duplicates], unresolvedItemIds: [...unresolved], lines,
    note: '数量按每个角码双安装面推导。套餐已标注配螺丝，不再追加螺丝采购；T母是否另购及全部规格需确认，不能直接用于采购下单。' };
}
