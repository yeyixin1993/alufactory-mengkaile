import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  buildDesignDocument,
  calculatePrice,
  normalizeDesignItems,
} from '../components/DIYDesigner';
import { inspectDesignerImportItems } from '../utils/designerImportPreflight';
import { classifyImportedComponent } from '../utils/designerComponentPricing';
import {
  INLINE_SOURCE_MESH_SCHEMA_VERSION,
  SHARED_SOURCE_GEOMETRY_SCHEMA_VERSION,
  SharedSourceGeometryError,
  expandImportedSourceGeometries,
  hashImportedSourceGeometry,
  shareImportedSourceGeometries,
} from '../utils/importedSourceGeometrySharing';
import { getStoolAccessoryGeometrySignature, resolveStoolAccessoryReference } from '../utils/stoolAccessoryAssets';
import { createDesignSourceInfo } from '../utils/designSource';

/**
 * Freezes the schema 3 "shared source geometry" contract.
 *
 * The 凳子 reference design places the same SHF12A support eight times and the
 * same braked caster four times. Schema 2 embedded a full copy of each
 * triangulation on every placement, so 84% of a 68.7 MB file was one mesh
 * repeated — which is the real reason a customer-facing design JSON was too big
 * to upload comfortably. Schema 3 stores one record per unique geometry and has
 * each placement point at it.
 *
 * "Shrink" is only acceptable if it is lossless, so this checks the parts that
 * would silently rot: the exact bytes handed back, the accessory geometry
 * signature (which is how a mesh proves it is its registered part), the price,
 * and that a document which cannot be put back exactly is refused rather than
 * imported with missing geometry.
 */

const fixturePath = path.resolve('scripts/fixtures/stool-import-20260930.json.gz');
const source = JSON.parse(gunzipSync(readFileSync(fixturePath)).toString('utf8')) as { items: Record<string, unknown>[] };
const rawItems = source.items as unknown as Parameters<typeof normalizeDesignItems>[0];

/** Mirrors the real import order: parse → expand → preflight → normalize. */
const importDocument = (document: { items: unknown[]; sourceGeometries?: unknown }, normalize = true) => {
  const expanded = expandImportedSourceGeometries(
    document.items as never[],
    (document as { sourceGeometries?: unknown }).sourceGeometries,
  ) as unknown as Parameters<typeof normalizeDesignItems>[0];
  const preflight = inspectDesignerImportItems(expanded);
  assert.equal(preflight.valid, true, `导入预检必须通过：${preflight.issues.map((issue) => issue.message).join('；')}`);
  return normalize ? normalizeDesignItems(expanded) : expanded;
};

/**
 * Report *which* field of two meshes differs. The meshes are megabytes long, so
 * a raw string diff is unreadable — this narrows a failure to a field (and, for
 * arrays, the first differing index) in one line.
 */
const describeMeshDifference = (actual: unknown, expected: unknown): string => {
  const a = actual as Record<string, unknown>;
  const b = expected as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])];
  for (const key of keys) {
    const left = JSON.stringify(a?.[key]);
    const right = JSON.stringify(b?.[key]);
    if (left === right) continue;
    const leftValue = a?.[key];
    if (Array.isArray(leftValue) && Array.isArray(b?.[key])) {
      const other = b[key] as unknown[];
      if (leftValue.length !== other.length) return `${key} 长度不同（${leftValue.length} vs ${other.length}）`;
      const index = leftValue.findIndex((entry, position) => JSON.stringify(entry) !== JSON.stringify(other[position]));
      return `${key}[${index}] 不同：${JSON.stringify(leftValue[index])} vs ${JSON.stringify(other[index])}`;
    }
    return `${key} 不同：${String(left).slice(0, 120)} vs ${String(right).slice(0, 120)}`;
  }
  return MESH_FIELDS_EQUAL;
};

const MESH_FIELDS_EQUAL = '字段集合与内容都相同';

const assertSameMesh = (restored: unknown, original: unknown, label: string) => {
  const difference = describeMeshDifference(restored, original);
  // Key order is deliberately not asserted: the exporter appends `uvs` after
  // `boundsMm` on textured meshes while the interface declares it next to
  // `normals`, and a reader must not have to reproduce a writer's field order.
  assert.equal(difference, MESH_FIELDS_EQUAL, `${label} 的源网格必须与内嵌形式逐字段一致，但 ${difference}`);
};

/** Item-by-item, because meshes are megabytes and a whole-document diff is unreadable. */
const assertSameItems = (actual: readonly unknown[], expected: readonly unknown[], label: string) => {
  assert.equal(actual.length, expected.length, `${label} 的零件数量必须不变`);
  expected.forEach((original, index) => {
    const restored = actual[index] as { id?: string; kind?: string; name?: string; sourceMesh?: unknown };
    const reference = original as { id?: string; kind?: string; name?: string; sourceMesh?: unknown };
    assert.equal(restored.id, reference.id, `${label} items[${index}] 的 id 必须保持不变`);
    if (reference.kind === 'imported_component') {
      assertSameMesh(restored.sourceMesh, reference.sourceMesh, `${label} items[${index}]（${reference.name}）`);
      const { sourceMesh: _restoredMesh, ...restoredRest } = restored;
      const { sourceMesh: _referenceMesh, ...referenceRest } = reference;
      assert.equal(JSON.stringify(restoredRest), JSON.stringify(referenceRest),
        `${label} items[${index}] 除源网格外的字段必须一致`);
      return;
    }
    assert.equal(JSON.stringify(restored), JSON.stringify(reference), `${label} items[${index}] 非导入件必须原样保留`);
  });
};
const baseline = normalizeDesignItems(rawItems);
const placedImported = baseline.filter((item) => item.kind === 'imported_component');
assert.equal(placedImported.length, 41, '凳子夹具的导入件数量已变化，去重基线需要重算');

// --- write side: one record per unique geometry -----------------------------
const shared = shareImportedSourceGeometries(baseline);
assert.ok(shared.sourceGeometries, '重复放置的源构件必须被合并成共享几何');
const uniqueRefs = Object.keys(shared.sourceGeometries!);
assert.equal(shared.placedCount, 41, '共享时必须记录全部 41 个放置');
assert.equal(shared.uniqueCount, uniqueRefs.length, '唯一几何数与共享记录数必须相等');
assert.ok(uniqueRefs.length < shared.placedCount, '没有去重就不是共享几何');
assert.ok(uniqueRefs.every((ref) => ref.startsWith('fnv1a32:')), '共享几何键必须是内容摘要');
// 8 supports share one mesh, 4 casters share one, and four parts are unique:
// decorative ×8, fixed_support ×16, handle ×1, shaft ×4.
assert.equal(uniqueRefs.length, 6, '凳子夹具应有 6 份唯一几何（支座/脚轮各 1 + 4 个单件）');
assert.equal(shared.items.filter((item) => (item as { sourceMesh?: { geometryRef?: string } }).sourceMesh?.geometryRef).length, 41,
  '每个导入件都应改为引用共享几何');

const inlineBytes = Buffer.byteLength(JSON.stringify({ items: baseline }), 'utf8');
const sharedBytes = Buffer.byteLength(JSON.stringify({ items: shared.items, sourceGeometries: shared.sourceGeometries }), 'utf8');
const savedRatio = 1 - sharedBytes / inlineBytes;
assert.ok(savedRatio > 0.7, `共享几何至少要省 70% 体积，当前只省了 ${(savedRatio * 100).toFixed(1)}%`);

// --- read side: byte-identical meshes, and the same array objects -----------
const expanded = importDocument(
  { items: shared.items as unknown[], sourceGeometries: shared.sourceGeometries },
  false,
) as unknown as typeof baseline;

assertSameItems(expanded, baseline, '展开后');

// The restored mesh must point straight at the shared record's array, not at a
// private copy: that is what makes the file smaller, and the mesh contract keeps
// those arrays immutable so several placements can safely share one.
expanded.forEach((item, index) => {
  if (item.kind !== 'imported_component') return;
  const ref = (shared.items[index] as { sourceMesh?: { geometryRef?: string } }).sourceMesh?.geometryRef;
  assert.equal((item as { sourceMesh: { positionsMm: number[] } }).sourceMesh.positionsMm,
    shared.sourceGeometries![ref!].positionsMm,
    `items[${index}] 的顶点数组应直接复用共享几何，而不是再复制一份`);
});

const distinctPositionArrays = new Set(expanded
  .filter((item) => item.kind === 'imported_component')
  .map((item) => (item as { sourceMesh: { positionsMm: number[] } }).sourceMesh.positionsMm));
assert.equal(distinctPositionArrays.size, uniqueRefs.length,
  `${placedImported.length} 个放置必须共享 ${uniqueRefs.length} 份顶点数组`);

// --- nothing that reads a mesh may notice ----------------------------------
type SourceMeshArgument = Parameters<typeof resolveStoolAccessoryReference>[0];
const meshOf = (item: { sourceMesh?: unknown }): SourceMeshArgument => item.sourceMesh as SourceMeshArgument;

const registered = baseline.filter((item) => resolveStoolAccessoryReference(meshOf(item)));
assert.equal(registered.length, 13, '凳子夹具应有 13 件能解析到内置配件资产的导入件');
expanded.forEach((item, index) => {
  if (item.kind !== 'imported_component') return;
  const before = meshOf(baseline[index] as { sourceMesh?: unknown });
  const after = meshOf(item as { sourceMesh?: unknown });
  assert.equal(getStoolAccessoryGeometrySignature(after), getStoolAccessoryGeometrySignature(before),
    `items[${index}] 的几何签名必须不变（配件身份靠它成立）`);
  assert.equal(
    JSON.stringify(resolveStoolAccessoryReference(after)), JSON.stringify(resolveStoolAccessoryReference(before)),
    `items[${index}] 的配件目录身份必须不变（零件清单的注册名/材质/规格靠它）`,
  );
  assert.equal(classifyImportedComponent({
    semanticType: (item as { sourceMesh?: { source?: { semanticType?: string } } }).sourceMesh?.source?.semanticType,
    componentName: (item as { name?: string }).name,
  }), classifyImportedComponent({
    semanticType: (baseline[index] as { sourceMesh?: { source?: { semanticType?: string } } }).sourceMesh?.source?.semanticType,
    componentName: (baseline[index] as { name?: string }).name,
  }), `items[${index}] 的计价类目必须不变`);
});

// --- the scene-item price is frozen separately from the cart's landing figure --
const asOrdered = (items: typeof baseline) => items.map((item) => (
  item.kind === 'imported_component' && classifyImportedComponent({
    semanticType: (item as { sourceMesh?: { source?: { semanticType?: string } } }).sourceMesh?.source?.semanticType,
    componentName: (item as { name?: string }).name,
  }) === 'caster'
    ? { ...item, wheelGrade: 'upgraded' as const }
    : item
));
const totalOf = (items: typeof baseline) => Number(asOrdered(items)
  .reduce((sum, item) => sum + calculatePrice(item), 0).toFixed(1));
assert.equal(totalOf(baseline), 887, '凳子参考设计（升级诺贝轮子）零件小计应为 ¥887（固定支座按 3号角码 3030 目录价）');
assert.equal(totalOf(expanded as typeof baseline), 887, '共享几何展开后零件小计必须仍是 ¥887');

// --- JSON round trip, because the file is the real unit of exchange ---------
const roundTripped = importDocument(JSON.parse(JSON.stringify({
  format: 'mengkaile-diy',
  schemaVersion: 3,
  coordinateUnit: 'mm',
  sourceGeometries: shared.sourceGeometries,
  items: shared.items,
})) as unknown as { items: unknown[]; sourceGeometries?: unknown });
assertSameItems(roundTripped, baseline, '写入 → JSON → 读取 → 归一化');

// --- the writer only shares when asked, and says so in the version ----------
const provenance = createDesignSourceInfo('parametric_template', { modelName: '共享几何回归' });
const inlineDocument = buildDesignDocument(baseline, 'cn', provenance);
assert.equal(inlineDocument.schemaVersion, INLINE_SOURCE_MESH_SCHEMA_VERSION, '默认导出必须仍是内嵌几何的老形式');
assert.equal('sourceGeometries' in inlineDocument, false, '默认导出不应带共享几何表');

const sharedDocument = buildDesignDocument(baseline, 'cn', provenance, null, { shareSourceGeometries: true });
assert.equal(sharedDocument.schemaVersion, SHARED_SOURCE_GEOMETRY_SCHEMA_VERSION, '共享几何导出必须声明 schemaVersion 3');
assert.ok(sharedDocument.sourceGeometries, '共享几何导出必须带 sourceGeometries');
const sharedDocumentBytes = Buffer.byteLength(JSON.stringify(sharedDocument), 'utf8');
const inlineDocumentBytes = Buffer.byteLength(JSON.stringify(inlineDocument), 'utf8');
assert.ok(sharedDocumentBytes < inlineDocumentBytes * 0.3,
  `设计器保存的共享形式应显著小于内嵌形式（${inlineDocumentBytes} → ${sharedDocumentBytes} 字节）`);
const reopened = importDocument(sharedDocument as unknown as { items: unknown[]; sourceGeometries?: unknown });
assertSameItems(reopened, baseline, '设计器保存 → 重新导入');

// --- fail closed: never import a document whose geometry cannot come back ---
const missingRecord = { ...shared.sourceGeometries } as Record<string, unknown>;
delete missingRecord[uniqueRefs[0]];
assert.throws(
  () => expandImportedSourceGeometries(shared.items as never[], missingRecord),
  (error: unknown) => error instanceof SharedSourceGeometryError && /不存在/.test((error as Error).message),
  '共享几何记录缺失时必须报错，不能静默丢掉零件',
);
assert.throws(
  () => expandImportedSourceGeometries(shared.items as never[], undefined),
  (error: unknown) => error instanceof SharedSourceGeometryError,
  '引用共享几何却没有几何表时必须报错',
);
const tampered = Object.fromEntries(Object.entries(shared.sourceGeometries!).map(([ref, geometry]) => (
  [ref, { ...geometry, positionsMm: [...geometry.positionsMm.slice(0, -1), geometry.positionsMm[geometry.positionsMm.length - 1] + 1] }]
)));
assert.throws(
  () => expandImportedSourceGeometries(shared.items as never[], tampered),
  (error: unknown) => error instanceof SharedSourceGeometryError && /摘要/.test((error as Error).message),
  '共享几何内容与键不一致时必须报错，不能把被改过的几何当原设计用',
);
const danglingRef = shared.items.map((item, index) => (index === 0
  ? { ...(item as object), sourceMesh: { ...(item as { sourceMesh: object }).sourceMesh, geometryRef: 'fnv1a32:deadbeef' } }
  : item));
assert.throws(
  () => expandImportedSourceGeometries(danglingRef as never[], shared.sourceGeometries),
  (error: unknown) => error instanceof SharedSourceGeometryError && /不存在/.test((error as Error).message),
  '悬空引用必须报错',
);
assert.throws(
  () => expandImportedSourceGeometries(baseline as never[], shared.sourceGeometries),
  (error: unknown) => error instanceof SharedSourceGeometryError && /没有任何零件引用/.test((error as Error).message),
  '带了共享几何表却无人引用时必须报错',
);
assert.equal(hashImportedSourceGeometry(shared.sourceGeometries![uniqueRefs[0]]), uniqueRefs[0],
  '共享几何键必须等于其内容摘要，引用才能自校验');

console.log('共享源几何（schemaVersion 3）回归通过');
console.log(`  体积: ${(inlineBytes / 1e6).toFixed(1)} MB → ${(sharedBytes / 1e6).toFixed(1)} MB`
  + `（省 ${(savedRatio * 100).toFixed(1)}%）`);
console.log(`  几何: ${shared.uniqueCount} 份唯一记录承载 ${shared.placedCount} 个放置`
  + `（省掉 ${shared.placedCount - shared.uniqueCount} 份重复三角剖分）`);
console.log(`  零件小计: ¥${totalOf(baseline)}（升级诺贝轮子；层间紧固件 ¥32 另计 ⇒ 落地 ¥952）`);
console.log(`  设计器保存: ${(inlineDocumentBytes / 1e6).toFixed(1)} MB → ${(sharedDocumentBytes / 1e6).toFixed(1)} MB`);
console.log('  不可还原的文档（缺失/悬空/被篡改/无人引用）全部被拒绝。');
