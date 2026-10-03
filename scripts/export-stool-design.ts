import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { calculatePrice } from '../components/DIYDesigner';
import { classifyImportedComponent } from '../utils/designerComponentPricing';
import { inspectDesignerImportItems } from '../utils/designerImportPreflight';
import { validateImportedSourceMeshFileSize } from '../utils/importedSourceMesh';

/**
 * Exports the owner's ¥880 reference design (凳子 + 诺贝 wheel upgrade, shipped
 * to 浙江) as a single importable `mengkaile-diy` / schemaVersion 2 JSON file.
 *
 * It is deliberately built from the same three pieces the designer itself uses:
 * the frozen 凳子 fixture, `classifyImportedComponent` for part identity and
 * `inspectDesignerImportItems` for the import preflight. So the file the owner
 * double-clicks can never disagree with `npm run test:stool-landed-total`.
 *
 * Output is written **compact**: the embedded source meshes make the pretty
 * form exceed the designer's 128 MiB import ceiling, while the compact form
 * stays comfortably inside it.
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
  grooveConvention?: unknown;
  items: Array<Record<string, any>>;
};

if (fixture.format !== 'mengkaile-diy' || fixture.schemaVersion !== 2 || fixture.coordinateUnit !== 'mm') {
  throw new Error(`夹具不再是 mengkaile-diy v2 (mm) 合同：${fixture.format}/${fixture.schemaVersion}/${fixture.coordinateUnit}`);
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

const document = {
  format: 'mengkaile-diy' as const,
  schemaVersion: 2 as const,
  savedAt: new Date().toISOString(),
  coordinateUnit: 'mm' as const,
  ...(fixture.provenance ? { provenance: fixture.provenance } : {}),
  ...(fixture.grooveConvention ? { grooveConvention: fixture.grooveConvention } : {}),
  items,
};

// Exactly what the designer runs when the owner picks this file.
const preflight = inspectDesignerImportItems(document.items);
if (!preflight.valid) {
  throw new Error(`导出被设计器导入预检拒绝：\n${preflight.issues.map((issue) => `${issue.field}: ${issue.message}`).join('\n')}`);
}

const serialized = JSON.stringify(document);
validateImportedSourceMeshFileSize(Buffer.byteLength(serialized, 'utf8'));

// Re-price the exported items through the designer's own calculator.
const total = items.reduce((sum, item) => sum + calculatePrice(item as any), 0);
const subtotal = Number(total.toFixed(1));
if (subtotal !== DESIGN_SUBTOTAL_CNY) {
  throw new Error(`设计估价小计 ¥${subtotal} 与冻结的 ¥${DESIGN_SUBTOTAL_CNY} 不一致，落地价不再是 ¥${LANDED_TOTAL_CNY}。`);
}

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, serialized, 'utf8');

const counts = items.reduce<Record<string, number>>((accumulator, item) => {
  accumulator[item.kind] = (accumulator[item.kind] || 0) + 1;
  return accumulator;
}, {});

console.log('凳子参考设计（升级诺贝轮子）导出完成');
console.log(`  文件: ${outputPath}`);
console.log(`  体积: ${(statSync(outputPath).size / 1e6).toFixed(2)} MB（设计器导入上限 128 MiB）`);
console.log(`  零件: ${items.length} 件 · ${Object.entries(counts).map(([kind, count]) => `${kind}×${count}`).join(' / ')}`);
console.log(`  诺贝轮子: ${upgradedWheelCount} 件（¥50/件）`);
console.log(`  设计估价小计: ¥${subtotal} → 发${DESTINATION_PROVINCE}落地 ¥${LANDED_TOTAL_CNY}`);
