import { getStoolAccessory, getStoolAccessoryBySemanticType, STOOL_ACCESSORY_CATALOG_REVISION, type StoolAccessoryId, type StoolAccessoryCatalogEntry } from '../data/stoolAccessoryCatalog';
import type { UnifiedPartReference } from '../data/stoolPartReference';
import type { ParametricSceneItem } from './parametricFurniture';
import { inspectImportedSourceMesh, type ImportedSourceMesh } from './importedSourceMesh';

type Vector = [number, number, number];
export type StoolAccessorySceneItem = ParametricSceneItem & { partCatalogRef: UnifiedPartReference };
const pending = new Map<StoolAccessoryId, Promise<ImportedSourceMesh>>();
const baseUrl = (url: string) => `${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`;

type CachedGeometry = { indices: number[]; normals: number[] | undefined; uvs: number[] | undefined;
  materials: ImportedSourceMesh['materials']; groups: ImportedSourceMesh['groups']; bounds: ImportedSourceMesh['boundsMm']; signature: string };
/** Source arrays are immutable by the imported-mesh contract. New JSON imports use fresh arrays. */
const geometrySignatures = new WeakMap<number[], CachedGeometry>();
export function getStoolAccessoryGeometrySignature(mesh: ImportedSourceMesh): string {
  const cached = geometrySignatures.get(mesh.positionsMm);
  if (cached && cached.indices === mesh.indices && cached.normals === mesh.normals && cached.uvs === mesh.uvs
    && cached.materials === mesh.materials && cached.groups === mesh.groups && cached.bounds === mesh.boundsMm) return cached.signature;
  let hash = 0x811c9dc5;
  const bytes = new DataView(new ArrayBuffer(8));
  const byte = (value: number) => { hash = Math.imul(hash ^ value, 0x01000193) >>> 0; };
  const number = (value: number) => { bytes.setFloat64(0, value, true); for (let i = 0; i < 8; i++) byte(bytes.getUint8(i)); };
  const string = (value: string) => { number(value.length); for (let i = 0; i < value.length; i++) { const n = value.charCodeAt(i); byte(n & 255); byte(n >>> 8); } };
  const array = (values: number[]) => { number(values.length); values.forEach(number); };
  array(mesh.positionsMm); array(mesh.normals || []); array(mesh.uvs || []); array(mesh.indices);
  number(mesh.materials.length);
  mesh.materials.forEach(material => {
    string(material.name); array(material.rgba); string(material.side || 'double'); string(material.textureColorMode || '');
    string(material.texture?.mimeType || ''); string(material.texture?.base64 || '');
  });
  number(mesh.groups.length); mesh.groups.forEach(group => { number(group.start); number(group.count); number(group.materialIndex); });
  array(mesh.boundsMm.min); array(mesh.boundsMm.max);
  const signature = `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
  geometrySignatures.set(mesh.positionsMm, { indices: mesh.indices, normals: mesh.normals, uvs: mesh.uvs,
    materials: mesh.materials, groups: mesh.groups, bounds: mesh.boundsMm, signature });
  return signature;
}

const sourceTypeIds: Readonly<Record<string, StoolAccessoryId>> = {
  decorative_profile: 'decorative_8080_30', handle: 'stainless_handle_126', caster: 'brake_caster_source',
};
/** Exact source family + hash + dimensions + geometry; names or a client reference alone are insufficient. */
export function identifyStoolAccessoryMesh(mesh: ImportedSourceMesh | undefined): StoolAccessoryCatalogEntry | undefined {
  if (!mesh || mesh.reviewStatus !== 'source_geometry_only' || mesh.schemaVersion !== 1 || mesh.coordinateSystem !== 'local-mm-y-up') return undefined;
  const entry = getStoolAccessoryBySemanticType(mesh.source?.semanticType)
    || getStoolAccessory(sourceTypeIds[mesh.source?.semanticType || '']);
  if (!entry || mesh.source.fileSha256 !== entry.sourceSha256 || !mesh.source.instancePath
    || !mesh.boundsMm || !Array.isArray(mesh.positionsMm) || !Array.isArray(mesh.indices)
    || !Array.isArray(mesh.materials) || !Array.isArray(mesh.groups)
    || !Array.isArray(mesh.boundsMm.min) || !Array.isArray(mesh.boundsMm.max)
    || entry.dimensionsMm.some((value, axis) => Math.abs(mesh.boundsMm.max[axis] - mesh.boundsMm.min[axis] - value) > 0.002)) return undefined;
  try { return getStoolAccessoryGeometrySignature(mesh) === entry.geometrySignature ? entry : undefined; }
  catch { return undefined; }
}

export function resolveStoolAccessoryReference(mesh: ImportedSourceMesh | undefined): UnifiedPartReference | undefined {
  const entry = identifyStoolAccessoryMesh(mesh);
  return entry ? { schemaVersion: 1, catalogRevision: STOOL_ACCESSORY_CATALOG_REVISION,
    catalogItemId: entry.catalogItemId, categoryId: entry.categoryId, sourceRecordId: entry.id } : undefined;
}

/** Promote only the catalog label; retains the original instance path and complete source hierarchy. */
export function markStoolAccessoryMesh(mesh: ImportedSourceMesh): ImportedSourceMesh {
  const entry = identifyStoolAccessoryMesh(mesh);
  return entry ? { ...mesh, source: { ...mesh.source, componentName: entry.name.cn, semanticType: entry.semanticType } } : mesh;
}

/** Reads the three standalone assets only. No inference from a component name or photograph. */
export function loadStoolAccessoryMesh(id: StoolAccessoryId): Promise<ImportedSourceMesh> {
  const entry = getStoolAccessory(id);
  if (!entry) return Promise.reject(new Error('没有找到该独立配件。'));
  let promise = pending.get(id);
  if (!promise) {
    promise = fetch(baseUrl(entry.meshJsonUrl)).then(async response => {
      if (!response.ok) throw new Error('独立配件模型加载失败，请重试。');
      const raw = await response.text();
      if (typeof crypto?.subtle?.digest === 'function') {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
        if (hash !== entry.sourceMeshSha256) throw new Error('独立配件模型校验失败，请刷新后重试。');
      }
      const mesh = JSON.parse(raw) as ImportedSourceMesh;
      const check = inspectImportedSourceMesh(mesh);
      if (!check.valid || mesh.source.fileSha256 !== entry.sourceSha256 || mesh.source.instancePath !== entry.sourcePath
        || mesh.source.semanticType !== entry.semanticType
        || entry.dimensionsMm.some((value, axis) => Math.abs(mesh.boundsMm.max[axis] - mesh.boundsMm.min[axis] - value) > 0.002)) {
        throw new Error('独立配件来源、几何或尺寸与目录不一致。');
      }
      if (identifyStoolAccessoryMesh(mesh)?.id !== id) throw new Error('独立配件几何签名与目录不一致。');
      return mesh;
    }).catch(error => { pending.delete(id); throw error; });
    pending.set(id, promise);
  }
  return promise;
}

export async function loadStoolAccessoryItem(id: StoolAccessoryId, options: { id?: string; position?: Vector; rotation?: Vector } = {}): Promise<StoolAccessorySceneItem> {
  const entry = getStoolAccessory(id);
  if (!entry) throw new Error('没有找到该独立配件。');
  const mesh = await loadStoolAccessoryMesh(id);
  const generatedId = options.id || `stool-accessory-${id}-${crypto.randomUUID()}`;
  return {
    id: generatedId, kind: 'imported_component', name: entry.name.cn,
    position: options.position || [0, -mesh.boundsMm.min[1], 0], rotation: options.rotation || [0, 0, 0],
    colorId: 'natural', quantity: 1, sourceMesh: mesh,
    partCatalogRef: { schemaVersion: 1, catalogRevision: STOOL_ACCESSORY_CATALOG_REVISION,
      catalogItemId: entry.catalogItemId, categoryId: entry.categoryId, sourceRecordId: entry.id },
    remark: `${entry.bom.specification}；${entry.material.label.cn}；目录记录不等于采购SKU，价格与安装仍待核。`,
  };
}
