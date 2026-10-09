import type { ImportedSourceMesh } from './importedSourceMesh';

/**
 * Shared source geometry for `mengkaile-diy` schemaVersion 3.
 *
 * A design that places the same source component several times used to embed a
 * full copy of its triangulation for every placement: the 凳子 reference design
 * carried the same 85,806-vertex SHF12A support eight times and the same
 * 53,242-vertex braked caster four times, so 84% of a 68.7 MB file was one mesh
 * repeated. An import contract cannot compress that away by cleverness — the
 * geometry really is needed, because imported parts are *drawn* from their
 * embedded triangles (`buildImportedSourceMeshObject`) — so the duplicate
 * copies have to stop being duplicated instead.
 *
 * Schema 3 keeps each item's own provenance (`sourceMesh.source`: file hash,
 * instance path, entity id, semantic type — never shared, because it differs
 * per placement) and moves the per-vertex half into one content-addressed
 * record per unique geometry:
 *
 *     "sourceGeometries": { "fnv1a32:1a2b3c4d": { positionsMm, indices, ... } },
 *     "items": [ { ..., "sourceMesh": { source, geometryRef: "fnv1a32:1a2b3c4d" } } ]
 *
 * Nothing about the geometry changes: the arrays are moved, not rewritten, and
 * `expandImportedSourceGeometries` puts back the exact same arrays (same object
 * identity even), so the accessory geometry signature, the price, the parts
 * list and the renderer all see byte-identical input. Schema 2 documents
 * (inline meshes, exactly what the SketchUp exporter and the AI JSON contract
 * still produce) remain valid and are read unchanged.
 *
 * The key is the geometry's own FNV-1a digest, which makes the reference
 * self-verifying: expansion recomputes it and refuses a document whose record
 * does not hash to the name it is filed under.
 */

/** The per-vertex half of a source mesh — the expensive part. */
export type ImportedSourceGeometry = Pick<
  ImportedSourceMesh,
  'schemaVersion' | 'coordinateSystem' | 'positionsMm' | 'normals' | 'uvs'
  | 'indices' | 'materials' | 'groups' | 'boundsMm' | 'reviewStatus'
>;

/** Content-addressed geometry records, keyed by `hashImportedSourceGeometry`. */
export type SharedSourceGeometries = Readonly<Record<string, ImportedSourceGeometry>>;

/** A `sourceMesh` record that points at shared geometry instead of carrying it. */
export interface SharedImportedSourceMesh {
  schemaVersion: ImportedSourceMesh['schemaVersion'];
  coordinateSystem: ImportedSourceMesh['coordinateSystem'];
  source: ImportedSourceMesh['source'];
  reviewStatus: ImportedSourceMesh['reviewStatus'];
  geometryRef: string;
}

export const SOURCE_GEOMETRY_REF_PREFIX = 'fnv1a32:';

/**
 * `mengkaile-diy` schema versions this build reads.
 *
 * 2 — meshes inline on every item (what the SketchUp exporter and the AI JSON
 *     contract produce; still the default for anything hand-authored).
 * 3 — the same document with `sourceGeometries` holding one record per unique
 *     geometry and items referencing it.
 *
 * The version is raised *only* when a document actually shares geometry, so a
 * design without repeated source components keeps the shape every reader
 * already knows.
 */
export const INLINE_SOURCE_MESH_SCHEMA_VERSION = 2;
export const SHARED_SOURCE_GEOMETRY_SCHEMA_VERSION = 3;
export const SUPPORTED_DESIGN_SCHEMA_VERSIONS = [
  INLINE_SOURCE_MESH_SCHEMA_VERSION, SHARED_SOURCE_GEOMETRY_SCHEMA_VERSION,
] as const;

export const isSupportedDesignSchemaVersion = (value: unknown): boolean => (
  SUPPORTED_DESIGN_SCHEMA_VERSIONS.includes(Number(value) as 2 | 3)
);

/**
 * Fields a shared record must carry. `normals` and `uvs` are deliberately absent:
 * the mesh contract makes both optional (`buildImportedSourceMeshObject` falls
 * back to `computeVertexNormals()`), so a record without them is complete.
 */
const REQUIRED_GEOMETRY_FIELDS = [
  'positionsMm', 'indices', 'materials', 'groups', 'boundsMm',
] as const;

/** Non-empty geometry record required by `inspectImportedSourceMesh`. */
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

/**
 * FNV-1a over the geometry half, as a stable content key.
 *
 * This is the same digest the accessory catalog uses to prove an embedded mesh
 * *is* its registered part (`getStoolAccessoryGeometrySignature`), which is why
 * it lives here and is called from there: one implementation, so a shared
 * document and an inline document agree on identity by construction.
 */
export function hashImportedSourceGeometry(geometry: ImportedSourceGeometry): string {
  let hash = 0x811c9dc5;
  const bytes = new DataView(new ArrayBuffer(8));
  const byte = (value: number) => { hash = Math.imul(hash ^ value, 0x01000193) >>> 0; };
  const number = (value: number) => {
    bytes.setFloat64(0, value, true);
    for (let index = 0; index < 8; index += 1) byte(bytes.getUint8(index));
  };
  const string = (value: string) => {
    number(value.length);
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      byte(code & 255);
      byte(code >>> 8);
    }
  };
  const array = (values: readonly number[]) => {
    number(values.length);
    values.forEach(number);
  };
  array(geometry.positionsMm);
  array(geometry.normals || []);
  array(geometry.uvs || []);
  array(geometry.indices);
  number(geometry.materials.length);
  geometry.materials.forEach((material) => {
    string(material.name);
    array(material.rgba);
    string(material.side || 'double');
    string(material.textureColorMode || '');
    string(material.texture?.mimeType || '');
    string(material.texture?.base64 || '');
  });
  number(geometry.groups.length);
  geometry.groups.forEach((group) => {
    number(group.start);
    number(group.count);
    number(group.materialIndex);
  });
  array(geometry.boundsMm.min);
  array(geometry.boundsMm.max);
  return `${SOURCE_GEOMETRY_REF_PREFIX}${hash.toString(16).padStart(8, '0')}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const looksLikeImportedSourceMesh = (value: unknown): value is ImportedSourceMesh => (
  isRecord(value) && isRecord(value.source) && !hasOwn(value, 'geometryRef')
);

/** Just the expensive half, so a caller can archive or hash it on its own. */
export const pickImportedSourceGeometry = (mesh: ImportedSourceMesh): ImportedSourceGeometry => ({
  schemaVersion: mesh.schemaVersion,
  coordinateSystem: mesh.coordinateSystem,
  positionsMm: mesh.positionsMm,
  ...(mesh.normals ? { normals: mesh.normals } : {}),
  ...(mesh.uvs ? { uvs: mesh.uvs } : {}),
  indices: mesh.indices,
  materials: mesh.materials,
  groups: mesh.groups,
  boundsMm: mesh.boundsMm,
  reviewStatus: mesh.reviewStatus,
});

/**
 * Rebuild a full mesh from a shared geometry record plus the item's own source.
 *
 * The arrays are handed over untouched and the fields are written back in the
 * documented `ImportedSourceMesh` order, so a mesh that was stripped and
 * restored serialises byte-for-byte like the inline original — which is what
 * lets the regression freeze the round trip with a plain `JSON.stringify`
 * comparison instead of a hand-written field list.
 */
export const mergeImportedSourceGeometry = (
  sourceMesh: Pick<SharedImportedSourceMesh, 'schemaVersion' | 'coordinateSystem' | 'source' | 'reviewStatus'>,
  geometry: ImportedSourceGeometry,
): ImportedSourceMesh => ({
  schemaVersion: sourceMesh.schemaVersion,
  coordinateSystem: sourceMesh.coordinateSystem,
  source: sourceMesh.source,
  positionsMm: geometry.positionsMm,
  ...(geometry.normals ? { normals: geometry.normals } : {}),
  ...(geometry.uvs ? { uvs: geometry.uvs } : {}),
  indices: geometry.indices,
  materials: geometry.materials,
  groups: geometry.groups,
  boundsMm: geometry.boundsMm,
  reviewStatus: sourceMesh.reviewStatus,
});

export interface ShareSourceGeometryResult<T> {
  readonly items: T[];
  /** Present only when at least one geometry was deduplicated. */
  readonly sourceGeometries?: SharedSourceGeometries;
  /** Unique geometries kept, out of `placedCount` placements. */
  readonly uniqueCount: number;
  readonly placedCount: number;
}

/**
 * Move every embedded mesh into one record per unique geometry.
 *
 * Items keep their own `source`; only the per-vertex half moves. Returns the
 * input untouched (`sourceGeometries` undefined) when there is nothing to share,
 * so a document without repeated components stays byte-identical to schema 2.
 */
export function shareImportedSourceGeometries<T extends { sourceMesh?: unknown }>(
  items: readonly T[],
): ShareSourceGeometryResult<T> {
  const geometries = new Map<string, ImportedSourceGeometry>();
  let placedCount = 0;
  const shared = items.map((item) => {
    const mesh = item.sourceMesh;
    if (!looksLikeImportedSourceMesh(mesh)) return item;
    placedCount += 1;
    const geometry = pickImportedSourceGeometry(mesh);
    const ref = hashImportedSourceGeometry(geometry);
    if (!geometries.has(ref)) geometries.set(ref, geometry);
    const sourceMesh: SharedImportedSourceMesh = {
      schemaVersion: mesh.schemaVersion,
      coordinateSystem: mesh.coordinateSystem,
      source: mesh.source,
      reviewStatus: mesh.reviewStatus,
      geometryRef: ref,
    };
    return { ...item, sourceMesh };
  });
  if (!placedCount) return { items: [...items], uniqueCount: 0, placedCount: 0 };
  return {
    items: shared,
    sourceGeometries: Object.fromEntries(geometries),
    uniqueCount: geometries.size,
    placedCount,
  };
}

export class SharedSourceGeometryError extends Error {}

const SOURCE_GEOMETRY_REF_PATTERN = /^fnv1a32:[0-9a-f]{8}$/;

/**
 * Put shared geometry back, and refuse anything that cannot be put back exactly.
 *
 * Deliberately strict: an unresolvable or mismatched reference throws instead of
 * quietly dropping a part, because a silently mesh-less item would render as
 * nothing while still being priced.
 */
export function expandImportedSourceGeometries<T extends { sourceMesh?: unknown; id?: string }>(
  items: readonly T[],
  sourceGeometries: unknown,
): T[] {
  const shared = new Map<string, ImportedSourceGeometry>();
  if (sourceGeometries !== undefined) {
    if (!isRecord(sourceGeometries)) throw new SharedSourceGeometryError('sourceGeometries 必须是「几何键 → 几何」的对象。');
    Object.entries(sourceGeometries).forEach(([ref, geometry]) => {
      if (!SOURCE_GEOMETRY_REF_PATTERN.test(ref)) throw new SharedSourceGeometryError(`共享几何键“${ref}”格式不正确。`);
      if (!isRecord(geometry)) throw new SharedSourceGeometryError(`共享几何“${ref}”必须是对象。`);
      for (const field of REQUIRED_GEOMETRY_FIELDS) {
        if (!hasOwn(geometry, field)) throw new SharedSourceGeometryError(`共享几何“${ref}”缺少 ${field}。`);
      }
      const record = geometry as unknown as ImportedSourceGeometry;
      const actual = hashImportedSourceGeometry(record);
      if (actual !== ref) {
        throw new SharedSourceGeometryError(`共享几何“${ref}”的内容摘要为“${actual}”，与键不一致，不能当作可信几何使用。`);
      }
      shared.set(ref, record);
    });
  }
  let resolved = 0;
  const expanded = items.map((item) => {
    const mesh = item.sourceMesh;
    if (!isRecord(mesh) || !hasOwn(mesh, 'geometryRef')) return item;
    const ref = String(mesh.geometryRef);
    const label = item.id ? `零件“${item.id}”` : '某个零件';
    if (!SOURCE_GEOMETRY_REF_PATTERN.test(ref)) {
      throw new SharedSourceGeometryError(`${label} 的 geometryRef“${ref}”格式不正确。`);
    }
    const geometry = shared.get(ref);
    if (!geometry) throw new SharedSourceGeometryError(`${label} 引用的共享几何“${ref}”不存在；文件不完整。`);
    resolved += 1;
    return {
      ...item,
      sourceMesh: mergeImportedSourceGeometry(mesh as unknown as SharedImportedSourceMesh, geometry),
    };
  });
  if (!resolved && shared.size) {
    throw new SharedSourceGeometryError(`文件带了 ${shared.size} 份共享几何，却没有任何零件引用它；不能假装几何已还原。`);
  }
  return expanded;
}

/** True when a parsed document carries the schema 3 shared form. */
export const hasSharedSourceGeometries = (document: unknown): boolean => (
  isRecord(document) && hasOwn(document, 'sourceGeometries') && isRecord(document.sourceGeometries)
);
