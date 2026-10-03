import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { buildDesignDocument, calculatePrice } from '../components/DIYDesigner';
import { classifyImportedComponent } from '../utils/designerComponentPricing';
import { inspectDesignerImportItems } from '../utils/designerImportPreflight';
import { validateImportedSourceMeshFileSize } from '../utils/importedSourceMesh';
import {
  SHARED_SOURCE_GEOMETRY_SCHEMA_VERSION,
  SUPPORTED_DESIGN_SCHEMA_VERSIONS,
  expandImportedSourceGeometries,
  isSupportedDesignSchemaVersion,
} from '../utils/importedSourceGeometrySharing';
import { createDesignSourceInfo } from '../utils/designSource';
import type { DesignSourceInfo } from '../types';

/**
 * Exports the owner's ¥880 reference design (凳子 + 诺贝 wheel upgrade, shipped
 * to 浙江) as one importable `mengkaile-diy` JSON file.
 *
 * It is built from the same three pieces the designer itself uses — the frozen
 * 凳子 fixture, `classifyImportedComponent` for part identity, and
 * `buildDesignDocument` for the file shape — so the file the owner double-clicks
 * can never disagree with `npm run test:stool-landed-total`.
 *
 * The document is written in the shared-geometry form (schemaVersion 3): the
 * design places the same SHF12A support eight times and the same braked caster
 * four times, and schema 2 embedded a full copy of each triangulation per
 * placement. One record per unique geometry takes the file from 68.7 MB to
 * ~11.4 MB with the geometry itself untouched. Output must stay **compact**:
 * pretty-printing pushes the embedded meshes past the designer's 128 MiB import
 * ceiling.
 *
 * Usage:
 *   npm run export:stool-880
 *   npm run export:stool-880 -- /absolute/path/out.json
 */

const DESIGN_SUBTOTAL_CNY = 847.0;
const LANDED_TOTAL_CNY = 880;
const DESTINATION_PROVINCE = '浙江';

const fixturePath = path.resolve('scripts/fixtures/stool-import-20260930.json.gz');
const defaultFileName = 'mengkaile-凳子-880-含诺贝轮.json';
const requestedPath = process.argv[2];
const outputPath = requestedPath
  ? path.resolve(requestedPath)
  : path.join(os.homedir(), 'Downloads', defaultFileName);

const fixture = JSON.parse(gunzipSync(readFileSync(fixturePath)).toString('utf8')) as {
  format: string;
  schemaVersion: number;
  coordinateUnit: string;
  provenance?: Record<string, unknown>;
  items: Array<Record<string, any>>;
};

if (fixture.format !== 'mengkaile-diy' || !isSupportedDesignSchemaVersion(fixture.schemaVersion)
    || fixture.coordinateUnit !== 'mm') {
  throw new Error(`夹具不再是 mengkaile-diy（${SUPPORTED_DESIGN_SCHEMA_VERSIONS.join('/')}）合同：`
    + `${fixture.format}/${fixture.schemaVersion}/${fixture.coordinateUnit}`);
}

const categoryOf = (item: Record<string, any>) => (
  item.kind === 'imported_component'
    ? classifyImportedComponent({
      semanticType: item.sourceMesh?.source?.semanticType,
      componentName: item.sourceMesh?.source?.componentName || item.name,
      catalogItemId: item.partCatalogRef?.catalogItemId,
      sourceRecordId: item.partCatalogRef?.sourceRecordId,
    })
    : null
);

// The owner's reference design ships with the 诺贝 wheel upgrade, so the
// exported file has to carry that choice on every source caster.
let upgradedWheelCount = 0;
const items = fixture.items.map((item) => {
  if (categoryOf(item) !== 'caster') return item;
  upgradedWheelCount += 1;
  return { ...item, wheelGrade: 'upgraded' as const };
});
if (!upgradedWheelCount) throw new Error('夹具里找不到脚轮，导出的文件不会等于落地价 ¥880。');

const provenance = (fixture.provenance
  || createDesignSourceInfo('parametric_template', { modelName: '凳子参考设计' })) as unknown as DesignSourceInfo;

// The designer's own writer, so the file is exactly what the Save button emits.
const document = buildDesignDocument(items as any, 'cn', provenance, null, { shareSourceGeometries: true });
if (document.schemaVersion !== SHARED_SOURCE_GEOMETRY_SCHEMA_VERSION || !document.sourceGeometries) {
  throw new Error('未能生成共享几何形式，导出器与设计器写入端已经不一致。');
}

// Read the result back the way the designer does: resolve the shared records,
// run the real import preflight, then re-price the parts that came out.
const reopened = expandImportedSourceGeometries(
  document.items as unknown[],
  document.sourceGeometries,
) as unknown as Array<Record<string, any>>;
const preflight = inspectDesignerImportItems(reopened);
if (!preflight.valid) {
  throw new Error(`导出被设计器导入预检拒绝：\n${preflight.issues.map((issue) => `${issue.field}: ${issue.message}`).join('\n')}`);
}
const subtotal = Number(reopened.reduce((sum, item) => sum + calculatePrice(item as any), 0).toFixed(1));
if (subtotal !== DESIGN_SUBTOTAL_CNY) {
  throw new Error(`设计估价小计 ¥${subtotal} 与冻结的 ¥${DESIGN_SUBTOTAL_CNY} 不一致，落地价不再是 ¥${LANDED_TOTAL_CNY}。`);
}

const serialized = JSON.stringify(document);
validateImportedSourceMeshFileSize(Buffer.byteLength(serialized, 'utf8'));

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, serialized, 'utf8');

const counts = reopened.reduce<Record<string, number>>((accumulator, item) => {
  accumulator[item.kind] = (accumulator[item.kind] || 0) + 1;
  return accumulator;
}, {});
const uniqueGeometryCount = Object.keys(document.sourceGeometries).length;

console.log('凳子参考设计（升级诺贝轮子）导出完成');
console.log(`  文件: ${outputPath}`);
console.log(`  体积: ${(statSync(outputPath).size / 1e6).toFixed(2)} MB（设计器导入上限 128 MiB）`);
console.log(`  合同: mengkaile-diy / schemaVersion ${document.schemaVersion}（共享源几何）`);
console.log(`  零件: ${reopened.length} 件 · ${Object.entries(counts).map(([kind, count]) => `${kind}×${count}`).join(' / ')}`);
console.log(`  几何: ${uniqueGeometryCount} 份唯一记录承载 ${counts.imported_component} 个导入件放置`);
console.log(`  诺贝轮子: ${upgradedWheelCount} 件（¥50/件）`);
console.log(`  设计估价小计: ¥${subtotal} → 发${DESTINATION_PROVINCE}落地 ¥${LANDED_TOTAL_CNY}`);
