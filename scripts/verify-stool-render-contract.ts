import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import {
  buildDesignDocument,
  createAccessoryObject,
  normalizeDesignItems,
  synchronizeDesignerSceneItems,
} from '../components/DIYDesigner';
import { createDesignSourceInfo } from '../utils/designSource';
import { inspectDesignerImportItems } from '../utils/designerImportPreflight';
import { DESIGNER_MM_PER_SCENE_UNIT } from '../utils/designerSceneUnits';

// Node/Three.js object-contract verification, not a browser/WebGL screenshot test.
// Usage after Vite SSR compilation: node <compiled.js> [editable.json] [report-prefix]
// Deliberately call the same accessory fallback used by older ThreeAssembly
// renderers. Reading sourceMesh directly would miss the invisible-hitbox bug.
type Item = Parameters<typeof createAccessoryObject>[0];
type Scene = Item[];
type Bounds = { min: number[]; max: number[] };
type MeshSnapshot = {
  id: string; semanticType: string; sourceInstancePath: string;
  sourceSha256: string; geometrySha256: string;
  positionMm: number[]; rotationDegrees: number[];
  realMeshCount: number; geometryTriangles: number; visibleTriangles: number;
  worldBoundsMm: Bounds; expectedBoundsMm: Bounds; maxBoundsErrorMm: number;
};

const inputPath = path.resolve(process.argv[2] || 'scripts/fixtures/stool-import-20260930.json.gz');
const reportPrefix = path.resolve(process.argv[3] || 'outputs/stool-import-fix-20260930/stool-render-contract');
const expectedRoles: Record<string, number> = {
  fixed_support: 16,
  shaft: 4,
  shaft_support: 8,
  'stool_accessory:brake_caster_source': 4,
  'stool_accessory:decorative_8080_30': 8,
  'stool_accessory:stainless_handle_126': 1,
};
const toleranceMm = 0.03; // Float32 renderer positions versus source JSON doubles.
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const boundsRecord = (box: THREE.Box3): Bounds => ({ min: box.min.toArray(), max: box.max.toArray() });
const report: {
  schemaVersion: number; status: 'running' | 'passed' | 'failed'; checkedAt: string;
  input: { path: string; sha256?: string; itemCount?: number };
  scope: string; actualBrowserValidated: false; toleranceMm: number;
  expectedSourceRoles: Record<string, number>; checks: string[];
  factorySnapshot: MeshSnapshot[]; reopenedSnapshot: MeshSnapshot[];
  rotatedProbe?: MeshSnapshot;
  error?: string;
} = {
  schemaVersion: 1, status: 'running', checkedAt: new Date().toISOString(),
  input: { path: inputPath }, actualBrowserValidated: false, toleranceMm,
  scope: 'Actual designer accessory factory, mm-to-scene scale, posed mesh bounds, and editable save/reimport. No WebGL, pixel visibility, or structural certification.',
  expectedSourceRoles: expectedRoles, checks: [], factorySnapshot: [], reopenedSnapshot: [],
};

const sourceItems = (items: Scene, phase: string) => {
  const source = items.filter(item => item.kind === 'imported_component');
  assert.equal(source.length, 41, `${phase}: all 41 source components must remain`);
  assert.equal(new Set(source.map(item => item.id)).size, 41, `${phase}: source IDs must be unique`);
  const counts: Record<string, number> = {};
  source.forEach(item => {
    assert.ok(item.sourceMesh, `${phase}: sourceMesh missing for ${item.id}`);
    assert.notEqual(item.sourceMesh.source.visible, false, `${phase}: source component hidden: ${item.id}`);
    assert.notEqual(item.importedBomOnly, true, `${phase}: source component reduced to BOM only: ${item.id}`);
    const role = item.sourceMesh.source.semanticType || '';
    counts[role] = (counts[role] || 0) + 1;
  });
  assert.deepEqual(counts, expectedRoles, `${phase}: stool source roles changed or disappeared`);
  return source;
};

const importItems = (items: Scene, phase: string): Scene => {
  const inspected = inspectDesignerImportItems(items);
  assert.equal(inspected.valid, true, `${phase}: ${JSON.stringify(inspected.issues)}`);
  return synchronizeDesignerSceneItems(normalizeDesignItems(items));
};

const materialWritesColor = (material: THREE.Material | undefined) => Boolean(
  material && material.visible && material.colorWrite && material.opacity > 0,
);
const renderSource = (item: Item): MeshSnapshot => {
  const source = item.sourceMesh!;
  // This must already return geometry in scene units. The canvas only supplies
  // the item pose; adding another 1/100 here would hide a double-scaling defect.
  const group = createAccessoryObject(item, false, false);
  try {
    group.position.set(...item.position.map(value => value / DESIGNER_MM_PER_SCENE_UNIT) as [number, number, number]);
    group.rotation.set(...item.rotation.map(THREE.MathUtils.degToRad) as [number, number, number], 'XYZ');
    group.updateMatrixWorld(true);
    const realBounds = new THREE.Box3();
    const vertex = new THREE.Vector3();
    let realMeshCount = 0;
    let geometryTriangles = 0;
    let visibleTriangles = 0;
    group.traverseVisible(child => {
      if (!(child instanceof THREE.Mesh) || child.userData.selectionProxy || child.userData.selectionDecoration) return;
      const materials: THREE.Material[] = Array.isArray(child.material) ? child.material : [child.material];
      if (!materials.some(materialWritesColor)) return;
      assert.ok(!(child instanceof THREE.InstancedMesh), `${item.id}: expand instanced geometry before checking it`);
      const geometry = child.geometry as THREE.BufferGeometry;
      const positions = geometry.getAttribute('position');
      const indexCount = geometry.index?.count ?? positions?.count ?? 0;
      if (!positions || indexCount < 3) return;
      realMeshCount += 1;
      geometryTriangles += indexCount / 3;
      const drawStart = geometry.drawRange.start;
      const drawEnd = Math.min(indexCount, drawStart + geometry.drawRange.count);
      const groups = Array.isArray(child.material) ? geometry.groups
        : [{ start: 0, count: indexCount, materialIndex: 0 }];
      for (const part of groups) {
        if (!materialWritesColor(materials[part.materialIndex || 0])) continue;
        visibleTriangles += Math.max(0, Math.min(drawEnd, part.start + part.count) - Math.max(drawStart, part.start)) / 3;
      }
      // Use posed vertices, not transformed local AABBs: the latter exaggerate
      // bounds after rotation and cannot catch a wrong axis/pose reliably.
      for (let index = 0; index < positions.count; index += 1) {
        vertex.fromBufferAttribute(positions, index).applyMatrix4(child.matrixWorld).multiplyScalar(DESIGNER_MM_PER_SCENE_UNIT);
        assert.ok(vertex.toArray().every(Number.isFinite), `${item.id}: non-finite rendered vertex`);
        realBounds.expandByPoint(vertex);
      }
    });
    assert.ok(realMeshCount > 0, `${item.id}: accessory factory produced no visible color-writing mesh (a selection hitbox is not geometry)`);
    assert.ok(visibleTriangles > 0, `${item.id}: material/draw groups render no triangles`);
    assert.equal(geometryTriangles, source.indices.length / 3, `${item.id}: accessory fallback must use all original source triangles`);
    assert.ok(!realBounds.isEmpty(), `${item.id}: empty renderer bounds`);

    const expectedBounds = new THREE.Box3();
    const pose = new THREE.Matrix4().compose(new THREE.Vector3(...item.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...item.rotation.map(THREE.MathUtils.degToRad) as [number, number, number], 'XYZ')),
      new THREE.Vector3(1, 1, 1));
    for (let index = 0; index < source.positionsMm.length; index += 3) {
      expectedBounds.expandByPoint(vertex.fromArray(source.positionsMm, index).applyMatrix4(pose));
    }
    const actual = boundsRecord(realBounds);
    const expected = boundsRecord(expectedBounds);
    const maxBoundsErrorMm = Math.max(...[...actual.min, ...actual.max].map((value, index) =>
      Math.abs(value - [...expected.min, ...expected.max][index])));
    assert.ok(maxBoundsErrorMm <= toleranceMm, `${item.id}: posed renderer bounds differ by ${maxBoundsErrorMm} mm; check scaling and rotation`);
    return {
      id: item.id, semanticType: source.source.semanticType || '', sourceInstancePath: source.source.instancePath,
      sourceSha256: source.source.fileSha256, geometrySha256: sha256(JSON.stringify(source)),
      positionMm: [...item.position], rotationDegrees: [...item.rotation],
      realMeshCount, geometryTriangles, visibleTriangles,
      worldBoundsMm: actual, expectedBoundsMm: expected, maxBoundsErrorMm,
    };
  } finally {
    group.traverse(child => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        (Array.isArray(child.material) ? child.material : [child.material]).forEach(material => material.dispose());
      }
    });
  }
};

try {
  const file = readFileSync(inputPath);
  const raw = inputPath.endsWith('.gz') ? gunzipSync(file) : file;
  report.input.sha256 = sha256(raw);
  const document = JSON.parse(raw.toString('utf8')) as { format: string; schemaVersion: number; items: Scene };
  assert.equal(document.format, 'mengkaile-diy');
  assert.equal(document.schemaVersion, 2);
  report.input.itemCount = document.items.length;
  const scene = importItems(document.items, 'initial import');
  const source = sourceItems(scene, 'initial import');
  report.factorySnapshot = source.map(renderSource);
  report.checks.push('41 source components create real color-writing meshes through createAccessoryObject; exact triangle totals and posed bounds verified');

  const reference = source[0];
  report.rotatedProbe = renderSource({ ...reference, position: [371.25, 219.5, -83.75], rotation: [17, 29, -11] });
  assert.equal(report.rotatedProbe.geometrySha256, report.factorySnapshot[0].geometrySha256,
    'Changing scene pose must not stretch or rewrite immutable source mesh');
  report.checks.push('Non-orthogonal XYZ rotation and translated source probe preserve source mesh and exact world bounds');
  for (const invalid of [
    { ...reference, sourceMesh: undefined },
    { ...reference, sourceMesh: null },
    { ...reference, sourceMesh: { ...reference.sourceMesh!, indices: [reference.sourceMesh!.positionsMm.length + 100, 0, 1] } },
  ]) {
    assert.throws(() => createAccessoryObject(invalid as Item, false, false),
      'Malformed/missing sourceMesh must throw instead of silently returning an invisible accessory');
  }
  report.checks.push('Missing, null and malformed sourceMesh rejected by actual accessory factory');

  const saved = buildDesignDocument(scene, 'cn', createDesignSourceInfo('parametric_template', { modelName: 'Stool renderer compatibility verification' }));
  const reopened = importItems(JSON.parse(JSON.stringify(saved)).items, 'saved/reimported');
  assert.equal(reopened.length, scene.length, 'Save/reimport must not remove scene items');
  const reopenedSources = sourceItems(reopened, 'saved/reimported');
  report.reopenedSnapshot = reopenedSources.map(renderSource);
  assert.deepEqual(report.reopenedSnapshot, report.factorySnapshot, 'Save/reimport must preserve source mesh appearance and scene pose');
  report.checks.push('Actual editable buildDesignDocument → JSON → import normalization/synchronization preserves all 41 rendered source meshes and poses');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  mkdirSync(path.dirname(reportPrefix), { recursive: true });
  writeFileSync(`${reportPrefix}.json`, JSON.stringify(report, null, 2));
  const roleLabels: Record<string, string> = {
    fixed_support: '固定支座', shaft: '光轴', shaft_support: 'SHF 轴支座',
    'stool_accessory:brake_caster_source': '脚轮', 'stool_accessory:decorative_8080_30': '8080 装饰块',
    'stool_accessory:stainless_handle_126': '拉手',
  };
  writeFileSync(`${reportPrefix}.md`, [
    '# 凳子源网格渲染兼容验收', '',
    `- Node 对象验收结果：${report.status}。${report.error ? `失败原因：${report.error}` : ''}`,
    `- 输入：${inputPath}`,
    `- 输入 SHA-256：${report.input.sha256 || '读取失败'}`,
    '- 此检查实际调用网站 createAccessoryObject 工厂，排除透明选择框；未运行浏览器或 WebGL，不能代替两站画面验收。',
    '- 工厂负责源网格毫米到场景单位的换算；Canvas 只设置位置与 XYZ 旋转，不可再缩放一次。',
    '- 可编辑 JSON 内嵌 sourceMesh；这类文件导入缺件不能仅靠补 GLB 或产品图片解决。',
    '', '| 源件 | 应有可见实体数 |', '| --- | ---: |',
    ...Object.entries(expectedRoles).map(([role, count]) => `| ${roleLabels[role]} | ${count} |`),
    '| 合计 | 41 |', '',
    '## 两站各自的浏览器验收清单（人工填写，以下未自动执行）', '',
    '- [ ] 记录本站 URL、构建版本和输入 JSON SHA；从实际部署页面导入。',
    '- [ ] 正常视图及单独选择/隔离视图均确认上表 41 个配件为实体，不是选中线框、材料清单或件数。',
    '- [ ] 从前、后、底部旋转查看脚轮、拉手、四光轴、两类支座和八装饰块；保留实际网页截图。',
    '- [ ] 编辑器、成品预览和下载 PNG 里显示同一套配件；确认纹理载入无报错。',
    '- [ ] 保存“可编辑设计 JSON”，在空白场景重新导入；41 件及各自位置、旋转仍正确。',
    '- [ ] 另测产品生成入口与三种独立配件插入/下载；检查本站 /models/ 资源真实返回 JSON/GLB，而非 SPA HTML。',
    '- [ ] 铝方程和萌开了分别留验收记录，不以一站通过代替另一站。',
    '- [ ] 连接节点、脚轮安装加工和承载另做工程复核；本渲染检查不证明连接可装配或可生产。', '',
  ].join('\n'));
  console.log(JSON.stringify({ status: report.status, input: report.input, checkedSourceMeshes: report.factorySnapshot.length,
    sourceTriangles: report.factorySnapshot.reduce((sum, item) => sum + item.geometryTriangles, 0),
    actualBrowserValidated: false, report: `${reportPrefix}.json`, checklist: `${reportPrefix}.md`, error: report.error }, null, 2));
}
