import {
  hasImportedSourceMesh,
  inspectImportedSourceMesh,
  importedTextureByteLength,
  MAX_IMPORTED_SOURCE_TRIANGLES,
  MAX_IMPORTED_SOURCE_TEXTURE_BYTES,
  type ImportedSourceMesh,
} from './importedSourceMesh';
import { hasImportedConnectionDraft, inspectImportedConnectionDraft } from './importedConnectionDraft';

/**
 * Read-only structural validation at the editable-model import boundary.
 * Passing this check does not approve machining, geometry, catalog identity or installation.
 * Optional legacy fields remain optional; no input value is normalized or discarded here.
 */
export interface DesignerImportIssue {
  readonly code: string;
  readonly itemId?: string;
  readonly itemIndex?: number;
  readonly field: string;
  readonly message: string;
}

export interface DesignerImportPreflightResult {
  readonly valid: boolean;
  readonly issues: readonly DesignerImportIssue[];
  readonly warnings: readonly DesignerImportIssue[];
}

// Mirrors the editable DIYItemKind contract, not the extension registry's future declarations.
const ITEM_KINDS = new Set([
  'profile', 'plate', 'pegboard', 'marine_board',
  'connector', 'extruded_connector', 'l_connector', 't_connector',
  'hidden_connector', 'tee_connector', 'shelf_support', 'screw',
  'foot', 'caster', 'end_cap', 'cabinet_door',
  'imported_component',
]);
const HOLE_SIDES = new Set(['A', 'B', 'C', 'D']);
const HOLE_TYPES = new Set(['through', 'countersunk', 'threaded']);
const DOOR_MATERIALS = new Set(['aluminum', 'marine', 'pegboard']);
const DOOR_OVERLAYS = new Set(['full', 'half', 'inset']);
const DOOR_OPENING_SIDES = new Set(['left', 'right']);
const MAX_DOOR_WIDTH_MM = 1500;
const MAX_DOOR_HEIGHT_MM = 3000;
const DIMENSIONS = ['length', 'width', 'height', 'thickness'] as const;
const DIMENSION_LABELS = { length: '长度', width: '宽度', height: '高度', thickness: '厚度' } as const;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);
const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);
const isVec3 = (value: unknown): boolean => (
  Array.isArray(value) && value.length === 3
  && isFiniteNumber(value[0]) && isFiniteNumber(value[1]) && isFiniteNumber(value[2])
);

export const inspectDesignerImportItems = (value: unknown): DesignerImportPreflightResult => {
  const issues: DesignerImportIssue[] = [];
  const warnings: DesignerImportIssue[] = [];
  if (!Array.isArray(value) || value.length === 0) {
    return {
      valid: false,
      issues: [{ code: 'items_missing', field: 'items', message: '未找到有效的构件列表；请选择包含模型构件的设计文件。' }],
      warnings,
    };
  }

  const itemIds = new Set<string>();
  let importedTriangleCount = 0;
  let importedTextureBytes = 0;
  const importedTextureBodies = new Set<string>();
  const itemKindsById = new Map<string, unknown>();
  value.forEach((item) => {
    if (isRecord(item) && typeof item.id === 'string' && item.id.trim() && !itemKindsById.has(item.id)) {
      itemKindsById.set(item.id, item.kind);
    }
  });
  for (let itemIndex = 0; itemIndex < value.length; itemIndex += 1) {
    const item: unknown = value[itemIndex];
    const itemId = isRecord(item) && typeof item.id === 'string' ? item.id : undefined;
    const label = `第 ${itemIndex + 1} 个构件${itemId?.trim() ? `（${itemId}）` : ''}`;
    const addIssue = (code: string, field: string, message: string) => {
      issues.push({ code, itemId, itemIndex, field, message: `${label}：${message}` });
    };
    const addWarning = (code: string, field: string, message: string) => {
      warnings.push({ code, itemId, itemIndex, field, message: `${label}：${message}` });
    };
    if (!isRecord(item)) {
      addIssue('item_invalid', `items[${itemIndex}]`, '构件记录必须是对象，不能是空值、数字或数组。');
      continue;
    }
    if (typeof item.id !== 'string' || !item.id.trim()) {
      addIssue('item_id_missing', 'id', '缺少非空构件编号，无法可靠保留连接关系。');
    } else if (itemIds.has(item.id)) {
      addIssue('item_id_duplicate', 'id', '构件编号重复，请在源模型中修正后重新导出。');
    } else itemIds.add(item.id);

    if (item.kind === 'aluminum_plate') {
      addIssue('item_kind_legacy_aluminum_plate', 'kind', '旧插件输出的 aluminum_plate 已不兼容；请更新 SketchUp 插件后重新导出，或将 kind 明确改为 plate。系统不会自动替换材料。');
    } else if (typeof item.kind !== 'string' || !ITEM_KINDS.has(item.kind)) {
      addIssue('item_kind_unsupported', 'kind', '构件类别缺失或当前设计器不支持；不会将其替换成型材。');
    }
    if (!isVec3(item.position)) addIssue('position_invalid', 'position', '位置必须是三个有限数值组成的毫米坐标。');
    if (!isVec3(item.rotation)) addIssue('rotation_invalid', 'rotation', '旋转必须是三个有限数值组成的角度，斜装角度可原样保留。');
    if (hasImportedConnectionDraft(item)) {
      inspectImportedConnectionDraft(item.importedConnectionDraft).forEach((message) => addIssue('imported_connection_draft_invalid', 'importedConnectionDraft', message));
      if (!['connector', 'hidden_connector', 'screw'].includes(String(item.kind))) addIssue('imported_connection_kind_invalid', 'kind', '源连接配件草案只能用于连接件或紧固件。');
      if (item.autoGenerated === true || item.lockedPosition === true || item.linkedHoleId || item.linkedProfileId || item.attachmentKey
        || (Array.isArray(item.attachedProfileIds) && item.attachedProfileIds.length)) addIssue('imported_connection_native_link_invalid', 'importedConnectionDraft', '源连接草案不能冒充原生型材自动连接或已加工孔位。');
      const members = isRecord(item.importedConnectionDraft) ? item.importedConnectionDraft.memberIds : null;
      if (Array.isArray(members)) {
        if (!Array.isArray(item.attachedPartIds) || item.attachedPartIds.length !== 2
          || [...item.attachedPartIds].sort().join('\u0000') !== [...members].sort().join('\u0000')) {
          addIssue('imported_connection_parents_invalid', 'attachedPartIds', '配件来源关联与连接草稿的两个父构件不一致。');
        }
        if (members.some((id) => itemKindsById.get(String(id)) !== 'imported_component')) {
          addWarning('imported_connection_parents_stale', 'importedConnectionDraft', '关联源构件已删除或替换；保留原配件草稿，重新扫描后处理待核位置。');
        }
      }
    }

    if (hasImportedSourceMesh(item)) {
      if (item.kind !== 'imported_component') {
        addIssue('source_mesh_kind_invalid', 'kind', '源网格必须使用 imported_component 身份，不能冒充原生型材、板材或配件 SKU。');
      }
      if (item.quantity !== undefined && item.quantity !== 1) {
        addIssue('source_mesh_quantity_invalid', 'quantity', '每个源实例必须保留单独 ID 和实际位姿，数量只能为 1；多个实物请保留多个实例。');
      }
      const meshResult = inspectImportedSourceMesh(item.sourceMesh);
      meshResult.issues.forEach((message) => addIssue('source_mesh_invalid', 'sourceMesh', message));
      if (meshResult.valid) {
        importedTriangleCount += meshResult.stats.triangles;
        for (const material of (item.sourceMesh as ImportedSourceMesh).materials) {
          if (!material.texture || importedTextureBodies.has(material.texture.base64)) continue;
          importedTextureBodies.add(material.texture.base64);
          importedTextureBytes += importedTextureByteLength(material.texture.base64);
        }
      }
    }

    for (const field of DIMENSIONS) {
      if (item[field] !== undefined && (!isFiniteNumber(item[field]) || item[field] <= 0)) {
        addIssue('dimension_invalid', field, `${DIMENSION_LABELS[field]}必须是大于零的有限数值；缺省旧字段仍可读取。`);
      }
    }
    if (item.quantity !== undefined && (!isFiniteNumber(item.quantity) || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      addIssue('quantity_invalid', 'quantity', '数量必须是正整数；成套滑轨继续按原有套数读取。');
    }

    if (item.kind === 'cabinet_door') {
      if (item.width === undefined) addIssue('door_width_missing', 'width', '柜门缺少实际宽度，不能用渲染占位尺寸代替生产尺寸。');
      else if (isFiniteNumber(item.width) && item.width > MAX_DOOR_WIDTH_MM) {
        addIssue('door_size_unsupported', 'width', `单扇柜门宽度不能超过 ${MAX_DOOR_WIDTH_MM}mm，请拆分门扇后重新导出。`);
      }
      if (item.height === undefined) addIssue('door_height_missing', 'height', '柜门缺少实际高度，不能用渲染占位尺寸代替生产尺寸。');
      else if (isFiniteNumber(item.height) && item.height > MAX_DOOR_HEIGHT_MM) {
        addIssue('door_size_unsupported', 'height', `单扇柜门高度不能超过 ${MAX_DOOR_HEIGHT_MM}mm，请拆分门扇后重新导出。`);
      }
      if (item.doorMaterial === undefined) {
        addWarning('door_material_defaulted', 'doorMaterial', '未提供柜门材料，将沿用旧文件默认值 aluminum（铝柜门）；生产前请核对。');
      } else if (typeof item.doorMaterial !== 'string' || !DOOR_MATERIALS.has(item.doorMaterial)) {
        addIssue('door_material_invalid', 'doorMaterial', '柜门材料必须为 aluminum、marine 或 pegboard，不会自动猜测。');
      }
      if (item.doorOverlay === undefined) {
        addWarning('door_overlay_defaulted', 'doorOverlay', '未提供覆盖方式，将沿用旧文件默认值 full（全盖）；生产前请核对。');
      } else if (typeof item.doorOverlay !== 'string' || !DOOR_OVERLAYS.has(item.doorOverlay)) {
        addIssue('door_overlay_invalid', 'doorOverlay', '柜门覆盖方式必须为 full、half 或 inset，不会自动猜测。');
      }
      if (item.openingSide === undefined) {
        addWarning('door_opening_side_defaulted', 'openingSide', '未提供开向，将沿用旧文件默认值 left（左开）；生产前请核对。');
      } else if (typeof item.openingSide !== 'string' || !DOOR_OPENING_SIDES.has(item.openingSide)) {
        addIssue('door_opening_side_invalid', 'openingSide', '柜门开向必须为 left 或 right，不会自动猜测。');
      }
      if (item.thickness === undefined) {
        addWarning('door_thickness_defaulted', 'thickness', '未提供柜门厚度，将沿用现有材料默认厚度；生产前请核对。');
      }
      if (item.attachedProfileIds === undefined) {
        addWarning('door_profiles_missing', 'attachedProfileIds', '未提供柜门所连接的型材编号；门板可继续作为旧文件草稿读取，但框架关系需人工复核。');
      } else if (!Array.isArray(item.attachedProfileIds)) {
        addIssue('door_profiles_invalid', 'attachedProfileIds', '柜门连接型材编号必须是字符串数组。');
      } else {
        const attachedIds = new Set<string>();
        if (item.attachedProfileIds.length === 0) {
          addWarning('door_profiles_missing', 'attachedProfileIds', '柜门没有记录连接型材；门板可继续作为旧文件草稿读取，但框架关系需人工复核。');
        }
        item.attachedProfileIds.forEach((profileId, profileIndex) => {
          const field = `attachedProfileIds[${profileIndex}]`;
          if (typeof profileId !== 'string' || !profileId.trim()) {
            addIssue('door_profile_id_invalid', field, '连接型材编号必须是非空字符串。');
          } else if (attachedIds.has(profileId)) {
            addIssue('door_profile_id_duplicate', field, `连接型材编号 ${profileId} 重复。`);
          } else {
            attachedIds.add(profileId);
            if (!itemKindsById.has(profileId)) {
              addIssue('door_profile_missing', field, `引用的型材 ${profileId} 不存在。`);
            } else if (itemKindsById.get(profileId) !== 'profile') {
              addIssue('door_profile_not_profile', field, `引用的构件 ${profileId} 不是型材。`);
            }
          }
        });
      }
    }

    if (item.holes === undefined) continue;
    if (!Array.isArray(item.holes)) {
      addIssue('holes_invalid', 'holes', '孔位列表必须是数组；没有孔时可省略该字段或使用空数组。');
      continue;
    }
    // Hole references are scoped by their owning component: screws carry both
    // linkedProfileId and linkedHoleId. Reusing h1 on two different profiles is
    // therefore valid, while reusing h1 twice on one profile is ambiguous.
    const holeIds = new Set<string>();
    for (let holeIndex = 0; holeIndex < item.holes.length; holeIndex += 1) {
      const hole: unknown = item.holes[holeIndex];
      const prefix = `holes[${holeIndex}]`;
      const holeLabel = `第 ${holeIndex + 1} 个孔`;
      if (!isRecord(hole)) {
        addIssue('hole_invalid', prefix, `${holeLabel}必须是孔位对象。`);
        continue;
      }
      if (typeof hole.id !== 'string' || !hole.id.trim()) {
        addIssue('hole_id_missing', `${prefix}.id`, `${holeLabel}缺少非空孔编号，无法保留螺丝关联。`);
      } else if (holeIds.has(hole.id)) {
        addIssue('hole_id_duplicate', `${prefix}.id`, `${holeLabel}编号 ${hole.id} 在同一构件中重复，会造成孔与螺丝关联冲突。`);
      } else holeIds.add(hole.id);
      if (typeof hole.side !== 'string' || !HOLE_SIDES.has(hole.side)) {
        addIssue('hole_side_invalid', `${prefix}.side`, `${holeLabel}的加工面必须为 A、B、C 或 D，不会自动猜测。`);
      }
      if (typeof hole.type !== 'string' || !HOLE_TYPES.has(hole.type)) {
        addIssue('hole_type_invalid', `${prefix}.type`, `${holeLabel}的类型必须为 through、countersunk 或 threaded。`);
      }
      if (!isFiniteNumber(hole.positionMm)) {
        addIssue('hole_position_invalid', `${prefix}.positionMm`, `${holeLabel}的孔位必须是有限的毫米数值。`);
      }
      for (const field of ['grooveIndex', 'physicalGrooveIndex'] as const) {
        if (hole[field] !== undefined && (!isFiniteNumber(hole[field]) || !Number.isInteger(hole[field]) || hole[field] < 0)) {
          addIssue('hole_groove_invalid', `${prefix}.${field}`, `${holeLabel}的槽位编号必须是从零开始的非负整数。`);
        }
      }
    }
  }
  if (importedTriangleCount > MAX_IMPORTED_SOURCE_TRIANGLES) issues.push({
    code: 'source_mesh_scene_limit', field: 'items',
    message: '源模型总三角形超过 200 万，请按实物组件分组导出；不能静默丢弃构件。',
  });
  if (importedTextureBytes > MAX_IMPORTED_SOURCE_TEXTURE_BYTES) issues.push({
    code: 'source_texture_scene_limit', field: 'items',
    message: '源模型独立贴图解码后总大小超过 32 MiB，请按实物组件分组导出；不能静默丢弃材质。',
  });
  return { valid: issues.length === 0, issues, warnings };
};
