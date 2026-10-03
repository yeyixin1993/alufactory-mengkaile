import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { STOOL_ACCESSORY_CATALOG } from '../data/stoolAccessoryCatalog';
import { getStoolAccessoryGeometrySignature, identifyStoolAccessoryMesh, resolveStoolAccessoryReference, markStoolAccessoryMesh, loadStoolAccessoryItem } from '../utils/stoolAccessoryAssets';
import { inspectImportedSourceMesh, type ImportedSourceMesh } from '../utils/importedSourceMesh';
import { inspectDesignerImportItems } from '../utils/designerImportPreflight';

const source = JSON.parse(readFileSync('public/models/stool/source-v1.json', 'utf8'));
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const results = [];
for (const entry of STOOL_ACCESSORY_CATALOG) {
  const raw = readFileSync(`public${entry.meshJsonUrl}`);
  const mesh = JSON.parse(raw.toString('utf8')) as ImportedSourceMesh;
  assert.equal(hash(raw), entry.sourceMeshSha256);
  assert.equal(getStoolAccessoryGeometrySignature(mesh), entry.geometrySignature);
  assert.equal(identifyStoolAccessoryMesh(mesh)?.id, entry.id);
  assert.equal(resolveStoolAccessoryReference(mesh)?.catalogItemId, entry.catalogItemId);
  assert.equal(inspectImportedSourceMesh(mesh).valid, true);
  assert.equal(entry.price.value, null);
  assert.equal(entry.sku, null);
  assert.equal(entry.productionEligible, false);
  const design = JSON.parse(readFileSync(`public${entry.sourceJsonUrl}`, 'utf8'));
  assert.equal(design.format, 'mengkaile-diy');
  assert.equal(design.schemaVersion, 2);
  assert.equal(design.items.length, 1);
  assert.equal(inspectDesignerImportItems(design.items).valid, true);
  assert.equal(resolveStoolAccessoryReference(design.items[0].sourceMesh)?.catalogItemId, entry.catalogItemId);
  const wrongHash = { ...mesh, source: { ...mesh.source, fileSha256: 'a'.repeat(64) } };
  assert.equal(resolveStoolAccessoryReference(wrongHash), undefined);
  const altered = { ...mesh, positionsMm: [...mesh.positionsMm] };
  altered.positionsMm[0] += 0.00001;
  assert.equal(resolveStoolAccessoryReference(altered), undefined, 'Changed geometry cannot claim a fixed catalog identity');
  const wrongType = { ...mesh, source: { ...mesh.source, semanticType: 'caster' } };
  if (entry.type !== 'caster') assert.equal(resolveStoolAccessoryReference(wrongType), undefined);
  const glb = readFileSync(`public${entry.previewUrl}`);
  assert.equal(glb.readUInt32LE(0), 0x46546c67); assert.equal(glb.readUInt32LE(4), 2); assert.equal(glb.readUInt32LE(8), glb.length);
  const jsonLength = glb.readUInt32LE(12), doc = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength).trim());
  assert.equal(doc.extras.coordinateUnit, 'mm'); assert.equal(doc.extras.sourceFileSha256, entry.sourceSha256);
  const positionAccessor = doc.accessors[doc.meshes[0].primitives[0].attributes.POSITION];
  const positionView = doc.bufferViews[positionAccessor.bufferView];
  const binStart = 20 + jsonLength + 8 + (positionView.byteOffset || 0);
  let maximumFloatErrorMm = 0;
  for (let i = 0; i < mesh.positionsMm.length; i++) maximumFloatErrorMm = Math.max(maximumFloatErrorMm, Math.abs(glb.readFloatLE(binStart + i * 4) - mesh.positionsMm[i]));
  assert(maximumFloatErrorMm < 0.001);
  assert.equal(doc.meshes[0].primitives.reduce((total: number, primitive: { indices: number }) => total + doc.accessors[primitive.indices].count, 0), mesh.indices.length);
  const png = readFileSync(`public${entry.thumbnailUrl}`);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  results.push({ id: entry.id, triangles: mesh.indices.length / 3, maximumFloatErrorMm });
}
let originalRecognized = 0;
for (const instance of source.instances) {
  const mesh = { ...source.meshes[instance.meshId], source: instance.source } as ImportedSourceMesh;
  const entry = identifyStoolAccessoryMesh(mesh);
  if (!entry) continue;
  originalRecognized++;
  assert(['caster', 'handle', 'decorative_profile'].includes(instance.type));
  const marked = markStoolAccessoryMesh(mesh);
  assert.equal(marked.source.instancePath, instance.sourcePath);
  assert.equal(marked.source.hierarchy, mesh.source.hierarchy);
  assert.equal(marked.positionsMm, mesh.positionsMm);
  assert.equal(marked.source.semanticType, entry.semanticType);
  assert.equal(resolveStoolAccessoryReference(marked)?.catalogItemId, entry.catalogItemId);
}
assert.equal(originalRecognized, 13);

const originalFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const path = String(input).replace(/^https?:\/\/[^/]+/, '');
  return new Response(readFileSync(`public${path}`), { status: 200 });
};
try {
  for (const entry of STOOL_ACCESSORY_CATALOG) {
    const item = await loadStoolAccessoryItem(entry.id, { id: `check-${entry.id}` });
    assert.equal(item.kind, 'imported_component'); assert.equal(item.id, `check-${entry.id}`);
    assert.equal(item.partCatalogRef.catalogItemId, entry.catalogItemId);
    assert.equal(inspectDesignerImportItems([item]).valid, true);
  }
} finally { globalThis.fetch = originalFetch; }
console.log(JSON.stringify({ valid: true, catalogEntries: results, originalRecognized, geometryMutationsRejected: true }, null, 2));
