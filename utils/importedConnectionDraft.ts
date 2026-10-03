import { validateImportedConnectionHardware } from './importedConnectionHardware';

/** Presence remains a manufacturing hold even if an imported marker is malformed. */
export const hasImportedConnectionDraft = (item: unknown): boolean => Boolean(item && typeof item === 'object'
  && Object.prototype.hasOwnProperty.call(item, 'importedConnectionDraft'));

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown, limit = 4096): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
const vector = (value: unknown) => Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number' && Number.isFinite(n));

/** A structural reader only: valid JSON never means validated hardware. */
export function inspectImportedConnectionDraft(value: unknown): string[] {
  const issues: string[] = [];
  if (!record(value)) return ['源模型连接草稿标记必须是对象。'];
  if (value.schemaVersion !== 1 || value.reviewStatus !== 'needs_review') issues.push('源连接方案只能声明 schemaVersion=1、needs_review，不能导入已放行状态。');
  if (!text(value.jointKey)) issues.push('源连接方案缺少有限长度节点编号。');
  if (!['corner_bracket', 'slot_connector', 'drill_tap'].includes(String(value.method))) issues.push('源连接方案方法不受支持。');
  const ids = value.memberIds;
  if (!Array.isArray(ids) || ids.length !== 2 || !ids.every((id) => text(id)) || ids[0] === ids[1]) issues.push('源连接方案必须引用两个不同的构件。');
  else if (value.jointKey !== [...ids].sort().join(':JOINT:')) issues.push('源连接方案节点编号与父构件引用不一致。');
  const poses = value.memberPoses;
  if (!Array.isArray(poses) || poses.length !== 2) issues.push('源连接方案缺少两件父构件的位姿记录。');
  else {
    const seen = new Set<string>();
    for (const pose of poses) {
      if (!record(pose) || !text(pose.id) || !vector(pose.position) || !vector(pose.rotation)
        || !text(pose.sourceFileSha256, 64) || !/^[a-f0-9]{64}$/i.test(String(pose.sourceFileSha256))
        || !text(pose.sourceInstancePath) || (pose.sourceGeometryFingerprint !== undefined && !text(pose.sourceGeometryFingerprint, 512))) {
        issues.push('源连接方案父构件的坐标、来源或几何记录无效。'); continue;
      }
      if (seen.has(pose.id) || (Array.isArray(ids) && !ids.includes(pose.id))) issues.push('源连接方案父构件位姿引用重复或不匹配。');
      seen.add(pose.id);
    }
  }
  if (!record(value.partPose) || !vector(value.partPose.position) || !vector(value.partPose.rotation) || !text(value.partPose.kind, 64)) {
    issues.push('源连接方案缺少配件自身的位姿与类别记录。');
  } else {
    for (const field of ['length', 'width', 'height', 'thickness']) {
      const n = value.partPose[field];
      if (n !== undefined && (typeof n !== 'number' || !Number.isFinite(n) || n <= 0)) issues.push('源连接方案配件尺寸记录无效。');
    }
  }
  if (value.machining !== undefined) {
    if (!Array.isArray(value.machining) || value.machining.length > 8) issues.push('源连接的待核加工建议无效。');
    else for (const suggestion of value.machining) {
      if (!record(suggestion) || !text(suggestion.profileId) || (Array.isArray(ids) && !ids.includes(suggestion.profileId))) {
        issues.push('待核加工建议必须引用本接点构件。'); continue;
      }
      if (suggestion.description !== undefined && !text(suggestion.description, 4096)) issues.push('待核加工说明过长或无效。');
      for (const field of ['tappingLeft', 'tappingRight']) if (suggestion[field] !== undefined && typeof suggestion[field] !== 'boolean') issues.push('待核攻丝字段必须是布尔值。');
      if (suggestion.holes !== undefined && (!Array.isArray(suggestion.holes) || suggestion.holes.length > 32 || !suggestion.holes.every(record))) issues.push('待核孔位建议无效或过多。');
    }
  }
  if (value.occupiedBoxesMm !== undefined) {
    if (!Array.isArray(value.occupiedBoxesMm) || !value.occupiedBoxesMm.length || value.occupiedBoxesMm.length > 16
      || value.occupiedBoxesMm.some((box) => !record(box) || !vector(box.position) || !vector(box.halfSizes)
        || (box.halfSizes as number[]).some((n) => n < 0 || n > 10000)
        || !Array.isArray(box.axes) || box.axes.length !== 3 || !box.axes.every(vector)
        || box.axes.some((axis: number[]) => Math.abs(Math.hypot(...axis) - 1) > 0.0001))) {
      issues.push('源连接草案的待核包络记录无效。');
    }
  }
  if (value.hardware !== undefined) {
    issues.push(...validateImportedConnectionHardware(value.hardware));
    if (value.method !== 'corner_bracket' || !record(value.partPose) || value.partPose.kind !== 'connector'
      || !record(value.hardware) || value.hardware.profileSeries !== value.partPose.accessoryProfileSize) {
      issues.push('No.1 配套清单与本连接件的类别或规格不一致。');
    }
  }
  return [...new Set(issues)];
}
