import * as THREE from 'three';

/** Source tessellation is editable placement evidence, never a manufacturing SKU. */
export interface ImportedSourceMaterial {
  name: string;
  rgba: [number, number, number, number];
  side?: 'front' | 'back' | 'double';
  /** Use replace for plain or source-API color-baked bitmap; rgba remains source evidence. */
  textureColorMode?: 'replace' | 'modulate';
  texture?: { mimeType: 'image/png' | 'image/jpeg'; base64: string };
}

export interface ImportedSourceMesh {
  schemaVersion: 1;
  coordinateSystem: 'local-mm-y-up';
  source: {
    fileSha256: string;
    instancePath: string;
    entityId?: string;
    componentName?: string;
    semanticType?: string;
    profileVariantId?: string;
    dimensionsMm?: Record<string, number>;
    materialName?: string;
    parentPath?: string;
    visible?: boolean;
    referenceOnly?: boolean;
    hierarchy?: { instancePath: string; parentPath?: string; name?: string; entityId?: string }[];
  };
  positionsMm: number[];
  normals?: number[];
  uvs?: number[];
  indices: number[];
  materials: ImportedSourceMaterial[];
  groups: { start: number; count: number; materialIndex: number }[];
  boundsMm: { min: [number, number, number]; max: [number, number, number] };
  reviewStatus: 'source_geometry_only';
}

export const MAX_IMPORTED_SOURCE_FILE_BYTES = 128 * 1024 * 1024;
export const MAX_IMPORTED_SOURCE_TRIANGLES = 2_000_000;
export const MAX_IMPORTED_SOURCE_TEXTURE_BYTES = 32 * 1024 * 1024;
const MAX_VERTICES_PER_MESH = 750_000;
const MAX_TRIANGLES_PER_MESH = 1_000_000;
const MAX_TEXTURE_BYTES = 8 * 1024 * 1024;
const MAX_GROUPS_PER_MESH = 500_000;
const MAX_MATERIALS_PER_MESH = 2_048;
const BOUND_TOLERANCE_MM = 0.002;
const MAX_TEXTURE_DIMENSION = 16_384;
const MAX_TEXTURE_PIXELS = 64_000_000;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const numericArray = (value: unknown, size?: number): value is number[] => Array.isArray(value)
  && (size === undefined || value.length === size) && Array.from(value).every(finite);
const nonemptyText = (value: unknown, limit: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;

export const hasImportedSourceMesh = (item: unknown): boolean => record(item)
  && (item.kind === 'imported_component' || Object.prototype.hasOwnProperty.call(item, 'sourceMesh'));

export function validateImportedSourceMeshFileSize(byteLength: number): void {
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0 || byteLength > MAX_IMPORTED_SOURCE_FILE_BYTES) {
    throw new Error('源模型 JSON 文件必须大于 0 且不超过 128 MiB；请分组导出，不能截断模型数据。');
  }
}

export const importedTextureByteLength = (base64: string) => Math.floor(base64.length * 3 / 4)
  - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);

// Keys are immutable image strings, so reuse is safe even when a caller edits a
// material record. Bounded retention avoids keeping old documents in memory.
const textureInspectionCache = new Map<string, { mimeType: string; width: number; height: number }>();
export function inspectImportedSourceTexture(texture: { mimeType: string; base64: string }) {
  const cached = textureInspectionCache.get(texture.base64);
  if (cached?.mimeType === texture.mimeType) return cached;
  const { base64, mimeType } = texture;
  if (!['image/png', 'image/jpeg'].includes(mimeType) || !base64.length
    || base64.length > Math.ceil(MAX_TEXTURE_BYTES / 3) * 4 || base64.length % 4 !== 0
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('纹理必须是合法嵌入 PNG/JPEG，且不超过 8 MiB。');
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const u32 = (offset: number) => (bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]);
  let width = 0; let height = 0;
  if (mimeType === 'image/png') {
    if (bytes.length < 45 || [137, 80, 78, 71, 13, 10, 26, 10].some((n, index) => bytes[index] !== n)
      || u32(8) !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') throw new Error('PNG 签名或 IHDR 缺失。');
    width = u32(16); height = u32(20);
    let offset = 8; let hasData = false; let ended = false;
    while (offset + 12 <= bytes.length) {
      const length = u32(offset);
      const kind = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
      if (length > bytes.length - offset - 12) throw new Error('PNG 数据块被截断。');
      if (kind === 'IDAT') hasData = true;
      offset += length + 12;
      if (kind === 'IEND') { ended = length === 0 && offset === bytes.length; break; }
    }
    if (!hasData || !ended) throw new Error('PNG 图像数据或结束块缺失。');
  } else {
    if (bytes.length < 12 || bytes[0] !== 255 || bytes[1] !== 216
      || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) throw new Error('JPEG 签名或结束标记缺失。');
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 255) throw new Error('JPEG 图像头无效。');
      while (bytes[offset] === 255) offset += 1;
      const marker = bytes[offset++];
      if (marker === 218 || marker === 217) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = (bytes[offset] << 8) + bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) throw new Error('JPEG 数据块被截断。');
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (length < 8) throw new Error('JPEG 尺寸头无效。');
        height = (bytes[offset + 3] << 8) + bytes[offset + 4];
        width = (bytes[offset + 5] << 8) + bytes[offset + 6];
      }
      offset += length;
    }
  }
  if (!width || !height || width > MAX_TEXTURE_DIMENSION || height > MAX_TEXTURE_DIMENSION
    || width * height > MAX_TEXTURE_PIXELS) throw new Error('源纹理像素尺寸无效或超过 16384 边长 / 6400 万像素限额。');
  const result = { mimeType, width, height };
  if (textureInspectionCache.size >= 8) textureInspectionCache.delete(textureInspectionCache.keys().next().value!);
  textureInspectionCache.set(base64, result);
  return result;
}

export function inspectImportedSourceMesh(value: unknown) {
  const issues: string[] = [];
  const stats = { vertices: 0, triangles: 0, textureBytes: 0 };
  const fail = (message: string) => { if (issues.length < 16) issues.push(message); };
  if (!record(value)) return { valid: false, issues: ['sourceMesh 必须是源网格对象。'], stats };
  if (value.schemaVersion !== 1 || value.coordinateSystem !== 'local-mm-y-up') fail('源网格版本或局部毫米/Y向上坐标声明不正确。');
  if (value.reviewStatus !== 'source_geometry_only') fail('源网格只能声明 source_geometry_only，不能凭导入声明制造已通过。');
  const source = value.source;
  if (!record(source) || typeof source.fileSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(source.fileSha256)
    || !nonemptyText(source.instancePath, 4096)) fail('缺少源文件 SHA-256 或唯一源实例路径。');
  if (record(source)) {
    for (const key of ['entityId', 'componentName', 'semanticType', 'profileVariantId', 'materialName', 'parentPath']) {
      if (source[key] !== undefined && (typeof source[key] !== 'string' || (source[key] as string).length > 4096)) fail(`源字段 ${key} 必须是有限长度的文字。`);
    }
    for (const key of ['visible', 'referenceOnly']) if (source[key] !== undefined && typeof source[key] !== 'boolean') fail(`源字段 ${key} 必须是布尔值。`);
    if (source.dimensionsMm !== undefined && (!record(source.dimensionsMm) || Object.keys(source.dimensionsMm).length > 64
      || !Object.values(source.dimensionsMm).every((n) => finite(n) && n >= 0))) fail('源尺寸必须为有限非负毫米数值；平面源允许零厚度。');
    if (source.hierarchy !== undefined) {
      if (!Array.isArray(source.hierarchy) || source.hierarchy.length > 2048) fail('每件源层级最多保留 2048 个节点。');
      else {
        const paths = new Set<string>();
        for (const node of source.hierarchy) {
          if (!record(node) || !nonemptyText(node.instancePath, 4096)) { fail('源层级节点必须有实际实例路径。'); continue; }
          if (paths.has(String(node.instancePath))) fail('源层级重复实例路径。');
          paths.add(String(node.instancePath));
          for (const key of ['parentPath', 'name', 'entityId']) {
            if (node[key] !== undefined && (typeof node[key] !== 'string' || (node[key] as string).length > 4096)) fail(`源层级字段 ${key} 无效。`);
          }
          if (node.parentPath === node.instancePath) fail('源层级节点不能以自己为父节点。');
        }
      }
    }
  }
  const positions = value.positionsMm;
  const positionLengthValid = Array.isArray(positions) && positions.length >= 9 && positions.length % 3 === 0
    && positions.length / 3 <= MAX_VERTICES_PER_MESH;
  if (!positionLengthValid) fail('源顶点必须为三元平面数组，每件最多 750000 个顶点。');
  let positionsValid = Boolean(positionLengthValid);
  const actualMin = [Infinity, Infinity, Infinity];
  const actualMax = [-Infinity, -Infinity, -Infinity];
  if (positionLengthValid) {
    stats.vertices = positions.length / 3;
    for (let index = 0; index < positions.length; index += 1) {
      const n = positions[index];
      if (!finite(n) || Math.abs(n) > 1e8) { positionsValid = false; break; }
      actualMin[index % 3] = Math.min(actualMin[index % 3], n);
      actualMax[index % 3] = Math.max(actualMax[index % 3], n);
    }
    if (!positionsValid) fail('源顶点包含无效或越界的毫米坐标。');
  }
  if (value.normals !== undefined && (!positionLengthValid || !numericArray(value.normals, positions.length))) fail('源法线必须与顶点逐一对应且为有限数值。');
  if (value.uvs !== undefined && (!positionLengthValid || !numericArray(value.uvs, stats.vertices * 2))) fail('源纹理 UV 必须与顶点逐一对应，每点两个有限数值。');
  const indices = value.indices;
  const indicesLengthValid = Array.isArray(indices) && indices.length >= 3 && indices.length % 3 === 0
    && indices.length / 3 <= MAX_TRIANGLES_PER_MESH;
  if (!indicesLengthValid) fail('源三角索引必须为三元组，每件最多 1000000 个三角形。');
  else {
    stats.triangles = indices.length / 3;
    if (!indices.every((n) => Number.isInteger(n) && n >= 0 && n < stats.vertices)) fail('源三角索引越界或不是整数。');
  }
  const bounds = value.boundsMm;
  if (!record(bounds) || !numericArray(bounds.min, 3) || !numericArray(bounds.max, 3)) fail('源网格缺少有效的局部包络。');
  else if (positionsValid && bounds.min.some((n, axis) => n > bounds.max[axis]
    || Math.abs(n - actualMin[axis]) > BOUND_TOLERANCE_MM
    || Math.abs(bounds.max[axis] - actualMax[axis]) > BOUND_TOLERANCE_MM)) fail('源包络与真实顶点不一致，不能使用外观占位尺寸。');
  const materials = value.materials;
  const materialsValid = Array.isArray(materials) && materials.length > 0 && materials.length <= MAX_MATERIALS_PER_MESH;
  if (!materialsValid) fail('源网格必须包含 1–2048 个真实来源材质记录。');
  else for (const material of materials) {
    if (!record(material) || !nonemptyText(material.name, 4096) || !numericArray(material.rgba, 4)
      || !material.rgba.every((n) => n >= 0 && n <= 255)) { fail('源材质必须有名称和 0–255 的 RGBA，不得用目录颜色替代。'); continue; }
    if (material.side !== undefined && !['front', 'back', 'double'].includes(String(material.side))) fail('源材质 side 必须为 front、back 或 double。');
    if (material.textureColorMode !== undefined && !['replace', 'modulate'].includes(String(material.textureColorMode))) fail('源贴图颜色模式必须为 replace 或 modulate。');
    if (material.texture !== undefined) {
      const texture = material.texture;
      if (!record(texture) || typeof texture.mimeType !== 'string' || typeof texture.base64 !== 'string') {
        fail('源纹理必须为合法嵌入 PNG/JPEG，每张不超过 8 MiB；不读取外部 URL。'); continue;
      }
      try { inspectImportedSourceTexture({ mimeType: texture.mimeType, base64: texture.base64 }); }
      catch (error) { fail(error instanceof Error ? error.message : '源纹理无效。'); continue; }
      stats.textureBytes += importedTextureByteLength(texture.base64);
      if (value.uvs === undefined) fail('带纹理的源网格缺少 UV，不能假装已完整还原贴图。');
    }
  }
  const groups = value.groups;
  if (!Array.isArray(groups) || !groups.length || groups.length > MAX_GROUPS_PER_MESH) fail('源材质组必须完整覆盖三角形。');
  else {
    let offset = 0;
    for (const group of groups) {
      if (!record(group) || !Number.isInteger(group.start) || group.start !== offset
        || !Number.isInteger(group.count) || Number(group.count) <= 0 || Number(group.count) % 3 !== 0
        || !Number.isInteger(group.materialIndex) || Number(group.materialIndex) < 0
        || !materialsValid || Number(group.materialIndex) >= materials.length) {
        fail('源材质组重复、缺口、越界或不按完整三角形排列。'); break;
      }
      offset += Number(group.count);
    }
    if (!indicesLengthValid || offset !== indices.length) fail('源材质组未恰好覆盖所有三角索引。');
  }
  return { valid: issues.length === 0, issues, stats };
}

/** Local millimetre geometry; caller applies scene scale, position and rotation once. */
export function buildImportedSourceMeshObject(value: ImportedSourceMesh, options: {
  selected?: boolean;
  transparent?: boolean;
  onTextureError?: (message: string) => void;
} = {}) {
  const inspected = inspectImportedSourceMesh(value);
  if (!inspected.valid) throw new Error(inspected.issues.join('；'));
  const group = new THREE.Group();
  group.name = `imported-source:${value.source.instancePath}`;
  group.userData.sourceGeometry = 'source_triangle_mesh';
  group.userData.sourceSha256 = value.source.fileSha256;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(value.positionsMm, 3));
  geometry.setIndex(value.indices);
  if (value.normals) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(value.normals, 3));
  else geometry.computeVertexNormals();
  if (value.uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(value.uvs, 2));
  value.groups.forEach((entry) => geometry.addGroup(entry.start, entry.count, entry.materialIndex));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const materials = value.materials.map((entry) => {
    const [r, g, b, alpha] = entry.rgba;
    const opacity = Math.min(alpha / 255, options.transparent ? 0.36 : 1);
    const material = new THREE.MeshStandardMaterial({
      name: entry.name,
      color: entry.texture && entry.textureColorMode === 'replace'
        ? new THREE.Color('#ffffff')
        : new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace),
      metalness: 0, roughness: 0.48,
      opacity, transparent: opacity < 1, depthWrite: opacity >= 1,
      side: entry.side === 'front' ? THREE.FrontSide : entry.side === 'back' ? THREE.BackSide : THREE.DoubleSide,
      emissive: options.selected ? '#164e63' : '#000000', emissiveIntensity: options.selected ? 0.12 : 0,
    });
    material.userData.sourceRgba = [...entry.rgba];
    if (entry.texture && typeof document !== 'undefined') {
      let disposed = false;
      const texture = new THREE.TextureLoader().load(`data:${entry.texture.mimeType};base64,${entry.texture.base64}`, (loaded) => {
        if (disposed) loaded.dispose();
      }, undefined, () => {
        if (disposed) return;
        const message = `源材质“${entry.name}”贴图解码失败；几何已保留，当前外观不完整，请重新核对源图片。`;
        group.userData.sourceTextureErrors = [...(group.userData.sourceTextureErrors || []), message];
        options.onTextureError?.(message);
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = true;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      material.map = texture;
      // This texture belongs to this rendered material only. The parent editor
      // rebuilds content on selection and calls material.dispose(); that must
      // also release the GPU image. No shared geometry/texture disposal hazard.
      material.addEventListener('dispose', () => { disposed = true; texture.dispose(); });
    }
    return material;
  });
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.name = value.source.componentName || value.source.instancePath;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}
