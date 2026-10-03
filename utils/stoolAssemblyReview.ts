import { Euler, Matrix4, Vector3 } from 'three';
import type { ImportedSourceMesh } from './importedSourceMesh';
import { STOOL_ACCESSORY_SOURCE_SHA256 } from '../data/stoolAccessoryCatalog';
import { ACCESSORY_ROWS } from '../data/accessoryCatalog';
import { resolveAccessoryUnitPrice } from './accessoryQuote';

type Point = [number, number, number];
export interface StoolAssemblyReviewItem {
  id: string;
  kind: string;
  name?: string;
  variantId?: string;
  position: readonly number[];
  rotation: readonly number[];
  length?: number;
  attachedProfileIds?: readonly string[];
  holes?: readonly { jointKey?: string }[];
  sourceMesh?: ImportedSourceMesh;
}
export interface StoolMountReview {
  id: string;
  localCenterMm: Point;
  worldCenterMm: Point;
  insertionDirection: Point;
  headSeatWorldMm: Point;
  plateThicknessMm: 4;
  diameterMm: 6.5;
  profileId?: string;
  profileName?: string;
  matchStatus: 'matched' | 'missing_mating_face' | 'ambiguous_mating_face' | 'source_geometry_changed';
  fasteningStatus: 'unverified';
}
export interface StoolFastenerCandidate {
  catalogItemId: string;
  label: string;
  status: 'candidate_unverified' | 'owner_confirmed';
  supplierSku: null;
  note: string;
}
export interface StoolSupportReview {
  itemId: string;
  sourcePath: string;
  label: string;
  tier: 'lower_fixed_to_middle' | 'upper_middle_to_seat';
  holes: StoolMountReview[];
  matchedProfileIds: string[];
  /** The physical fastening itself is still unverified on hardware. */
  fasteningStatus: 'unverified';
  /** Whether the *purchasing specification* has been decided. */
  fastenerSpecStatus: 'owner_confirmed';
  candidateFastener: StoolFastenerCandidate;
  candidateNut: StoolFastenerCandidate;
}
export interface StoolAssemblyGroupReview {
  scopeId: string;
  profileIds: string[];
  expectedSupportCount: 16;
  supportCount: number;
  supports: StoolSupportReview[];
  /** Declared frame-hardware links only; no physical fastening assertion. */
  profileComponents: string[][];
  /** Planned geometric bridges only; these are not installed connections. */
  geometricBridgeComponents: string[][];
  unmatchedMountCount: number;
  missingSupportCount: number;
  missingSupportLabels: string[];
  installationSteps: readonly string[];
  /**
   * Computed assembly failures. These keep the design out of production: they
   * mean the model itself is wrong, not that a physical check is outstanding.
   */
  blockingIssues: string[];
  /**
   * Known-unverified statements. They are true of every stool design and cannot
   * be resolved by the model, so they do not block the design — they have to be
   * acknowledged before an order is placed.
   */
  advisoryNotes: string[];
  /** `blockingIssues` then `advisoryNotes`, kept for readers that want one list. */
  issues: string[];
}
export interface StoolAssemblyReview {
  applicable: boolean;
  /** Source brackets have no verified screw/nut mapping in this narrow review. */
  complete: false;
  assemblies: StoolAssemblyGroupReview[];
  totals: {
    assemblies: number; supports: number; expectedSupports: number; mounts: number;
    matchedMounts: number; unmatchedMounts: number; missingSupports: number;
    candidateScrews: number; candidateNuts: number;
  };
  /** Owner-confirmed purchasing specification these candidates now carry. */
  fastenerSpec: StoolSupportFastenerSpec;
  blockingIssues: string[];
  advisoryNotes: string[];
  issues: string[];
}

/**
 * The purchasing specification the owner confirmed on 2026-10-03 for the 凳子's
 * sixteen three-tier frame supports (source path root/instances-5..8/1..4).
 *
 * This replaces the earlier "candidate, nothing selected" state: the thread, the
 * length and the nut are decided, so the fasteners can be priced and bought.
 * What the owner confirmed is the *specification*, not an installed joint — the
 * physical engagement, washer stack and tool clearance are still checked on
 * hardware, which is why `fasteningStatus` stays `unverified`.
 *
 * Both identities already exist in `data/accessoryCatalog.ts`; the price is read
 * from there so the design and the accessory list cannot disagree.
 */
export interface StoolSupportFastenerSpec {
  /** Where the specification came from, so a saved review cannot look invented. */
  readonly source: 'owner_confirmed_2026-10-03';
  readonly screwCatalogItemId: '10_3030_m6x12_cap';
  readonly nutCatalogItemId: '10_3030_m6_tnut';
  readonly screwLabel: string;
  readonly nutLabel: string;
  readonly threadSize: 'M6';
  readonly lengthMm: 12;
  /** Measured from the source CAD, not from a supplier drawing. */
  readonly plateThicknessMm: 4;
  readonly boreDiameterMm: 6.5;
  /** One screw and one slot nut per mounting face; the source bracket has two. */
  readonly setsPerSupport: 2;
}

export const STOOL_SUPPORT_FASTENER_SPEC: StoolSupportFastenerSpec = Object.freeze({
  source: 'owner_confirmed_2026-10-03',
  screwCatalogItemId: '10_3030_m6x12_cap',
  nutCatalogItemId: '10_3030_m6_tnut',
  screwLabel: 'M6×12 圆柱头内六角螺丝',
  nutLabel: '3030 M6 T型螺母',
  threadSize: 'M6',
  lengthMm: 12,
  plateThicknessMm: 4,
  boreDiameterMm: 6.5,
  setsPerSupport: 2,
});

export const STOOL_ASSEMBLY_INSTALLATION_STEPS = [
  '先完成主体与80mm装饰短柱：上端钻攻螺丝须在中框、座框叠上前紧固。',
  '下层8个固定件连接固定上框与中框；先定位槽螺母，再从内侧开口紧固中框底面的螺丝。',
  '在拆离的座框上预装上层8个固定件并紧固向上的螺丝；装好后下方固定框会限制直工具进入。',
  '将座框和上层固定件一起落到中框，再从四周30mm层间隙紧水平螺丝；实物螺母、啮合量与工具净空仍须核定。',
] as const;

const TOLERANCE_MM = 0.02;
const sideLabels: Record<number, string> = { 5: '前侧', 6: '后侧', 7: '左侧', 8: '右侧' };
const SOURCE_PATH = /^root\/instances-([5-8])\/instances-([1-4])$/;
const expectedPaths = [5, 6, 7, 8].flatMap((side) => [1, 2, 3, 4].map((part) => `root/instances-${side}/instances-${part}`));
const scopeOf = (id: string): string | undefined => {
  if (!id.startsWith('parametric-stool-')) return undefined;
  const imported = /^(parametric-stool-import-.+)-part-\d+(?:_\d+)?$/.exec(id);
  if (imported) return imported[1];
  return id.startsWith('parametric-stool-import-') ? undefined : 'parametric-stool-original';
};
const labelForPath = (sourcePath: string) => {
  const match = SOURCE_PATH.exec(sourcePath)!;
  const part = Number(match[2]);
  return `${sideLabels[Number(match[1])]}${part === 1 || part === 4 ? '下层' : '上层'}固定件${part === 1 || part === 2 ? '1' : '2'}`;
};
const validPose = (item: StoolAssemblyReviewItem) => item.position.length === 3 && item.rotation.length === 3
  && [...item.position, ...item.rotation].every(Number.isFinite);
const matrixFor = (item: StoolAssemblyReviewItem) => new Matrix4().makeRotationFromEuler(new Euler(
  item.rotation[0] * Math.PI / 180, item.rotation[1] * Math.PI / 180, item.rotation[2] * Math.PI / 180, 'XYZ',
)).setPosition(...item.position as Point);
const point = (v: Vector3): Point => v.toArray().map((value) => Number(value.toFixed(6))) as Point;
const close = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE_MM;

/** Confirm the measured mounting planes/rims still exist, instead of trusting a source tag alone. */
function hasMeasuredMountGeometry(mesh: ImportedSourceMesh): boolean {
  if (!close(mesh.boundsMm.min[0], -13.5) || !close(mesh.boundsMm.max[0], 13.5)
    || ![1, 2].every((axis) => close(mesh.boundsMm.min[axis], -15) && close(mesh.boundsMm.max[axis], 15))) return false;
  const positions = mesh.positionsMm;
  if (positions.length % 3 !== 0 || mesh.indices.length % 3 !== 0) return false;
  return ([1, 2] as const).every((axis) => {
    const across = axis === 1 ? 2 : 1;
    const rim = new Set<string>(); let outerTriangles = 0; let innerTriangles = 0;
    for (let n = 0; n < positions.length; n += 3) {
      if (Math.abs(positions[n + axis] + 15) < 0.00002
        && Math.abs(Math.hypot(positions[n], positions[n + across]) - 3.25) < 0.00002) {
        rim.add(`${positions[n].toFixed(5)},${positions[n + across].toFixed(5)}`);
      }
    }
    for (let n = 0; n < mesh.indices.length; n += 3) {
      const coordinates = mesh.indices.slice(n, n + 3).map((index) => positions[index * 3 + axis]);
      if (coordinates.every((value) => Math.abs(value + 15) < 0.00002)) outerTriangles++;
      if (coordinates.every((value) => Math.abs(value + 11) < 0.00002)) innerTriangles++;
    }
    return rim.size === 42 && outerTriangles >= 46 && innerTriangles >= 46;
  });
}

function components(ids: readonly string[], edges: readonly (readonly string[])[]): string[][] {
  const graph = new Map(ids.map((id) => [id, new Set<string>()]));
  edges.forEach(([a, b]) => {
    if (a !== b && graph.has(a) && graph.has(b)) { graph.get(a)!.add(b); graph.get(b)!.add(a); }
  });
  const seen = new Set<string>(); const groups: string[][] = [];
  for (const id of [...ids].sort()) {
    if (seen.has(id)) continue;
    const queue = [id]; const group: string[] = [];
    while (queue.length) {
      const current = queue.pop()!;
      if (seen.has(current)) continue;
      seen.add(current); group.push(current); queue.push(...graph.get(current)!);
    }
    groups.push(group.sort());
  }
  return groups.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}

function frameEdges(items: readonly StoolAssemblyReviewItem[], profileIds: ReadonlySet<string>): string[][] {
  const edges: string[][] = [];
  items.forEach((item) => {
    if ((item.kind === 'hidden_connector' || item.kind === 'connector') && item.attachedProfileIds?.length === 2
      && item.attachedProfileIds.every((id) => profileIds.has(id))) edges.push([...item.attachedProfileIds]);
    if (!profileIds.has(item.id)) return;
    item.holes?.forEach((hole) => {
      if (!hole.jointKey?.endsWith(':DRILL-TAP')) return;
      const ids = hole.jointKey.slice(0, -':DRILL-TAP'.length).split(':JOINT:');
      if (ids.length === 2 && ids.includes(item.id) && ids.every((id) => profileIds.has(id))) edges.push(ids);
    });
  });
  return edges;
}

const fastenerCandidate = (): StoolFastenerCandidate => ({
  catalogItemId: STOOL_SUPPORT_FASTENER_SPEC.screwCatalogItemId,
  label: `${STOOL_SUPPORT_FASTENER_SPEC.screwLabel}（规格已确认）`,
  status: 'owner_confirmed', supplierSku: null,
  note: `源CAD孔Ø${STOOL_SUPPORT_FASTENER_SPEC.boreDiameterMm}、板厚${STOOL_SUPPORT_FASTENER_SPEC.plateThicknessMm}；`
    + `${STOOL_SUPPORT_FASTENER_SPEC.lengthMm}mm 为穿板后的采购长度。垫片、啮合量与工具净空仍待实物核定。`,
});
const nutCandidate = (): StoolFastenerCandidate => ({
  catalogItemId: STOOL_SUPPORT_FASTENER_SPEC.nutCatalogItemId,
  label: `${STOOL_SUPPORT_FASTENER_SPEC.nutLabel}（规格已确认）`,
  status: 'owner_confirmed', supplierSku: null,
  note: '业主 2026-10-03 确认规格。螺母装入方向与槽内定位方式仍待实物核定。',
});

/** The one true statement that no model can settle; every stool carries it. */
const installationVerificationNote = (sets: number) => `${sets} 套紧固件的实物安装验证（拧紧扭矩、工具进入顺序）仍待复核；`
  + '几何接触不计为已紧固。';

/** A read-only completeness review for this stool; planned contact never counts as fastening. */
export function reviewStoolAssembly(items: readonly StoolAssemblyReviewItem[]): StoolAssemblyReview {
  const scopes = new Map<string, StoolAssemblyReviewItem[]>();
  items.forEach((item) => {
    const scope = scopeOf(item.id);
    if (!scope) return;
    if (!scopes.has(scope)) scopes.set(scope, []);
    scopes.get(scope)!.push(item);
  });
  const geometryChecks = new Map<ImportedSourceMesh, boolean>();
  const assemblies: StoolAssemblyGroupReview[] = [];
  for (const [scopeId, scoped] of scopes) {
    const profiles = scoped.filter((item) => item.kind === 'profile');
    const supports = scoped.filter((item) => item.sourceMesh?.source.fileSha256 === STOOL_ACCESSORY_SOURCE_SHA256
      && item.sourceMesh.source.semanticType === 'fixed_support' && SOURCE_PATH.test(item.sourceMesh.source.instancePath));
    if (!profiles.length && !supports.length) continue;
    const blocking: string[] = [];
    const advisories: string[] = [];
    // A namespace representing more than one saved assembly cannot be guessed apart.
    const ambiguousScope = profiles.length > 32;
    if (ambiguousScope) blocking.push('同一导入批次包含超过32根凳子型材，无法可靠区分装配归属；未自动跨接。');
    const candidates = profiles.filter((item) => item.variantId === '3030' && validPose(item)
      && Number.isFinite(item.length) && item.length! > 0).map((item) => ({ item, inverse: matrixFor(item).invert() }));
    const reviewed: StoolSupportReview[] = supports.map((support) => {
      const mesh = support.sourceMesh!; const sourcePath = mesh.source.instancePath; const sourceMatch = SOURCE_PATH.exec(sourcePath)!;
      const occurrence = Number(sourceMatch[2]); const pose = validPose(support);
      const matrix = pose ? matrixFor(support) : new Matrix4();
      if (!geometryChecks.has(mesh)) geometryChecks.set(mesh, hasMeasuredMountGeometry(mesh));
      const geometryValid = geometryChecks.get(mesh)! && pose;
      const holes: StoolMountReview[] = ([1, 2] as const).map((axis) => {
        const localCenter = new Vector3().setComponent(axis, -15);
        const normal = new Vector3().setComponent(axis, -1).transformDirection(matrix);
        const center = localCenter.clone().applyMatrix4(matrix);
        const otherAxis = axis === 1 ? 2 : 1;
        const corners = [-1, 1].flatMap((xSign) => [-1, 1].map((crossSign) => localCenter.clone()
          .setX(xSign * 13.5).setComponent(otherAxis, crossSign * 15).applyMatrix4(matrix)));
        const matches = geometryValid && !ambiguousScope ? candidates.filter(({ item, inverse }) => {
          const local = center.clone().applyMatrix4(inverse);
          const inward = normal.clone().transformDirection(inverse);
          const face = Math.abs(inward.y) > 0.999 ? 1 : Math.abs(inward.z) > 0.999 ? 2 : -1;
          if (face < 0 || Math.abs(inward.x) > 0.001) return false;
          const across = face === 1 ? 2 : 1;
          if (!close(local.getComponent(face), -15 * Math.sign(inward.getComponent(face)))
            || !close(local.getComponent(across), 0)) return false;
          return corners.every((corner) => {
            const p = corner.clone().applyMatrix4(inverse);
            return Math.abs(p.x) <= item.length! / 2 + TOLERANCE_MM
              && Math.abs(p.getComponent(across)) <= 15 + TOLERANCE_MM
              && close(p.getComponent(face), local.getComponent(face));
          });
        }) : [];
        const matchStatus = !geometryValid ? 'source_geometry_changed' : ambiguousScope || matches.length > 1
          ? 'ambiguous_mating_face' : matches.length === 1 ? 'matched' : 'missing_mating_face';
        return {
          id: `${support.id}:MOUNT-${axis}`, localCenterMm: point(localCenter), worldCenterMm: point(center),
          insertionDirection: point(normal), headSeatWorldMm: point(center.clone().addScaledVector(normal, -4)),
          plateThicknessMm: 4, diameterMm: 6.5, matchStatus, fasteningStatus: 'unverified',
          ...(matches.length === 1 ? { profileId: matches[0].item.id, profileName: matches[0].item.name } : {}),
        };
      });
      return {
        itemId: support.id, sourcePath, label: labelForPath(sourcePath),
        tier: occurrence === 1 || occurrence === 4 ? 'lower_fixed_to_middle' : 'upper_middle_to_seat',
        holes, matchedProfileIds: holes.flatMap((hole) => hole.profileId ? [hole.profileId] : []),
        fasteningStatus: 'unverified', fastenerSpecStatus: 'owner_confirmed',
        candidateFastener: fastenerCandidate(), candidateNut: nutCandidate(),
      };
    });
    const sourcePaths = new Set(reviewed.map((support) => support.sourcePath));
    const missing = expectedPaths.filter((path) => !sourcePaths.has(path));
    const duplicates = reviewed.length - sourcePaths.size;
    const unmatchedMountCount = reviewed.reduce((sum, support) => sum + support.holes.filter((hole) => hole.matchStatus !== 'matched').length, 0);
    // Real model failures. Only these keep the design out of production.
    if (profiles.length !== 32) blocking.push(`检测到${profiles.length}根凳子型材，基准装配应为32根。`);
    if (missing.length) blocking.push(`缺少${missing.length}个三层框架固定件：${missing.map(labelForPath).join('、')}。`);
    if (duplicates) blocking.push(`发现${duplicates}个重复源固定件，安装归属待核。`);
    if (unmatchedMountCount) blocking.push(`${unmatchedMountCount}个固定件安装位没有唯一、贴合且对准槽线的3030配合面。`);
    // Known unknowns. True of a perfect model too, so they advise rather than block.
    advisories.push(installationVerificationNote(reviewed.length * STOOL_SUPPORT_FASTENER_SPEC.setsPerSupport));
    const ids = profiles.map((item) => item.id); const edges = frameEdges(items, new Set(ids));
    const bridges = reviewed.filter((support) => support.holes.every((hole) => hole.matchStatus === 'matched')
      && new Set(support.matchedProfileIds).size === 2).map((support) => support.matchedProfileIds);
    assemblies.push({
      scopeId, profileIds: ids, expectedSupportCount: 16, supportCount: reviewed.length, supports: reviewed,
      profileComponents: components(ids, edges), geometricBridgeComponents: components(ids, [...edges, ...bridges]),
      unmatchedMountCount, missingSupportCount: missing.length, missingSupportLabels: missing.map(labelForPath),
      installationSteps: STOOL_ASSEMBLY_INSTALLATION_STEPS,
      blockingIssues: blocking, advisoryNotes: advisories, issues: [...blocking, ...advisories],
    });
  }
  const supportCount = assemblies.reduce((sum, assembly) => sum + assembly.supportCount, 0);
  const unmatched = assemblies.reduce((sum, assembly) => sum + assembly.unmatchedMountCount, 0);
  const blockingIssues = [...new Set(assemblies.flatMap((assembly) => assembly.blockingIssues))];
  const advisoryNotes = [...new Set(assemblies.flatMap((assembly) => assembly.advisoryNotes))];
  return {
    applicable: assemblies.length > 0, complete: false, assemblies,
    totals: { assemblies: assemblies.length, supports: supportCount, expectedSupports: assemblies.length * 16,
      mounts: supportCount * 2, matchedMounts: supportCount * 2 - unmatched, unmatchedMounts: unmatched,
      missingSupports: assemblies.reduce((sum, assembly) => sum + assembly.missingSupportCount, 0),
      candidateScrews: assemblies.length * 32, candidateNuts: assemblies.length * 32 },
    fastenerSpec: STOOL_SUPPORT_FASTENER_SPEC,
    blockingIssues, advisoryNotes,
    issues: [...blockingIssues, ...advisoryNotes],
  };
}

/** One purchasable line of the owner-confirmed stool fastening set. */
export interface StoolSupportFastenerLine {
  catalogItemId: string;
  label: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  /** True when this many pieces reached the catalog's own bulk threshold. */
  bulkApplied: boolean;
}

export interface StoolSupportFasteners {
  applicable: boolean;
  /** Supports carrying the owner-confirmed fastener set. */
  supports: number;
  /** Screw-and-nut sets; one per mounting face of each support. */
  sets: number;
  lines: StoolSupportFastenerLine[];
  total: number;
  spec: StoolSupportFastenerSpec;
}

const EMPTY_FASTENERS: StoolSupportFasteners = {
  applicable: false, supports: 0, sets: 0, lines: [], total: 0, spec: STOOL_SUPPORT_FASTENER_SPEC,
};

/**
 * The stool's tier fasteners as real, priced purchasing lines.
 *
 * The assembly review already enumerates every mounting face, so this only has
 * to turn the owner-confirmed specification into catalogue lines. Both
 * identities exist in `data/accessoryCatalog.ts` and are priced through the
 * accessory list's own colour/bulk rule, so the design quote, the cart and the
 * printed accessory list name one SKU at one price.
 *
 * A support that cannot be placed contributes no line: an unverified mount must
 * not silently buy hardware.
 */
export function materializeStoolSupportFasteners(
  items: readonly StoolAssemblyReviewItem[],
): StoolSupportFasteners {
  const review = reviewStoolAssembly(items);
  if (!review.applicable) return EMPTY_FASTENERS;
  const supports = review.assemblies.flatMap((assembly) => assembly.supports);
  const placedSupports = supports.filter((support) => (
    support.holes.every((hole) => hole.matchStatus === 'matched')
  ));
  if (!placedSupports.length) return EMPTY_FASTENERS;
  const sets = placedSupports.length * STOOL_SUPPORT_FASTENER_SPEC.setsPerSupport;
  const lines = [
    { catalogItemId: STOOL_SUPPORT_FASTENER_SPEC.screwCatalogItemId, label: STOOL_SUPPORT_FASTENER_SPEC.screwLabel },
    { catalogItemId: STOOL_SUPPORT_FASTENER_SPEC.nutCatalogItemId, label: STOOL_SUPPORT_FASTENER_SPEC.nutLabel },
  ].flatMap(({ catalogItemId, label }): StoolSupportFastenerLine[] => {
    const row = ACCESSORY_ROWS.find((candidate) => candidate.defId === catalogItemId);
    // The spec is only usable while the catalog still prices it; a missing row
    // must not turn into a free part.
    if (!row) return [];
    const unitPrice = resolveAccessoryUnitPrice(row, 'natural', sets);
    return [{
      catalogItemId, label, quantity: sets, unitPrice,
      subtotal: Number((unitPrice * sets).toFixed(2)),
      bulkApplied: unitPrice < row.price.natural,
    }];
  });
  return {
    applicable: lines.length > 0,
    supports: placedSupports.length,
    sets,
    lines,
    total: Number(lines.reduce((sum, line) => sum + line.subtotal, 0).toFixed(2)),
    spec: STOOL_SUPPORT_FASTENER_SPEC,
  };
}
