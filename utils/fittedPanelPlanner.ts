export type FittedPanelMountMode = 'recessed' | 'front_flush' | 'overlay';
export type FittedPanelMaterialKind = 'marine_board' | 'plate' | 'pegboard';

export interface FittedPanelRectMm {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export interface FittedPanelOpening {
  key: string;
  profileIds: string[];
  outer: FittedPanelRectMm;
  inner: FittedPanelRectMm;
  frontZ: number;
  rearZ: number;
  columnIndex: number;
  columnCount: number;
}

export interface FittedPanelObstacle {
  id: string;
  label: string;
  kind: string;
  axisAligned: boolean;
  bounds: FittedPanelRectMm & { rear: number; front: number };
}

export interface FittedPanelParameters {
  openingKey: string;
  materialKind: FittedPanelMaterialKind;
  mountMode: FittedPanelMountMode;
  thicknessMm: number;
  /** Per-edge clearance from the detected clear opening. */
  clearGapMm: number;
  /** Distance from the frame front plane to the board front face. */
  recessMm: number;
  /** Per-edge reveal from the detected outside frame envelope. */
  overlayEdgeGapMm: number;
  autoAvoidance: boolean;
  /** Design allowance around a real geometric intersection, not a tool tolerance. */
  avoidanceClearanceMm: number;
}

export interface FittedPanelCutout {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  sourceId: string;
  sourceLabel: string;
  sourceKind: string;
  touchesEdge: boolean;
}

export interface FittedPanelSolidCell {
  centerXmm: number;
  centerYmm: number;
  widthMm: number;
  heightMm: number;
}

export interface FittedPanelPlan {
  valid: boolean;
  errors: string[];
  warnings: string[];
  bounds: FittedPanelRectMm;
  widthMm: number;
  heightMm: number;
  center: [number, number, number];
  frontFaceZ: number;
  cutouts: FittedPanelCutout[];
  unresolvedObstacles: string[];
  solidCells: FittedPanelSolidCell[];
  solidComponentCount: number;
  solidAreaRatio: number;
}

export const findFittedPanelSolidConflicts = (
  plan: FittedPanelPlan,
  thicknessMm: number,
  blockers: readonly FittedPanelObstacle[],
) => {
  if (!plan.valid || !finite(thicknessMm) || thicknessMm <= 0) return [] as string[];
  const rear = plan.center[2] - thicknessMm / 2;
  const front = plan.center[2] + thicknessMm / 2;
  const labels = blockers.flatMap((blocker) => {
    const zOverlap = Math.min(front, blocker.bounds.front) - Math.max(rear, blocker.bounds.rear);
    if (zOverlap <= 0.05) return [];
    const intersectsSolid = plan.solidCells.some((cell) => {
      const centerX = plan.center[0] + cell.centerXmm;
      const centerY = plan.center[1] + cell.centerYmm;
      const left = centerX - cell.widthMm / 2;
      const right = centerX + cell.widthMm / 2;
      const bottom = centerY - cell.heightMm / 2;
      const top = centerY + cell.heightMm / 2;
      return Math.min(right, blocker.bounds.right) - Math.max(left, blocker.bounds.left) > 0.05
        && Math.min(top, blocker.bounds.top) - Math.max(bottom, blocker.bounds.bottom) > 0.05;
    });
    return intersectsSolid ? [blocker.label] : [];
  });
  return [...new Set(labels)];
};

export interface FittedPanelDraftMarker {
  schemaVersion: 1;
  status: 'engineering_draft';
  exactFit: false;
  requiresPhysicalReview: true;
  openingKey: string;
  mountMode: FittedPanelMountMode;
  materialKind: FittedPanelMaterialKind;
  clearGapMm: number;
  recessMm: number;
  overlayEdgeGapMm: number;
  avoidanceMode: 'off' | 'actual_intersection';
  avoidanceClearanceMm: number;
  cutouts: FittedPanelCutout[];
  unresolvedObstacles: string[];
}

export const FITTED_PANEL_MANUFACTURING_HOLD = '框架适配板件仍是工程草稿：安装支撑/槽深、板材牌号、避让加工与固定方式须结合实物复核，当前不能直接生成生产资料。';
export const FITTED_PANEL_DRAFT_VARIANT_ID = 'frame-fitted-panel-draft-v1';
export const FITTED_PANEL_MATERIAL_THICKNESSES: Readonly<Record<FittedPanelMaterialKind, readonly number[]>> = {
  marine_board: [12, 18],
  plate: [1, 2, 3, 4, 5],
  pegboard: [2, 5],
};
export const FITTED_PANEL_DEFAULT_THICKNESS: Readonly<Record<FittedPanelMaterialKind, number>> = {
  marine_board: 18,
  plate: 2,
  pegboard: 2,
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 3) => Number(value.toFixed(digits));

const normalizeCutouts = (
  widthMm: number,
  heightMm: number,
  cutouts: readonly FittedPanelCutout[],
) => cutouts.flatMap((cutout) => {
  if (![cutout.xMm, cutout.yMm, cutout.widthMm, cutout.heightMm].every(finite)) return [];
  const left = clamp(cutout.xMm, 0, widthMm);
  const right = clamp(cutout.xMm + cutout.widthMm, 0, widthMm);
  const bottom = clamp(cutout.yMm, 0, heightMm);
  const top = clamp(cutout.yMm + cutout.heightMm, 0, heightMm);
  if (right - left < 0.1 || top - bottom < 0.1) return [];
  return [{
    ...cutout,
    xMm: round(left),
    yMm: round(bottom),
    widthMm: round(right - left),
    heightMm: round(top - bottom),
  }];
});

export const buildFittedPanelSolidCells = (
  widthMm: number,
  heightMm: number,
  rawCutouts: readonly FittedPanelCutout[],
) => {
  if (!finite(widthMm) || !finite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    return { cells: [] as FittedPanelSolidCell[], componentCount: 0, solidAreaRatio: 0 };
  }
  const cutouts = normalizeCutouts(widthMm, heightMm, rawCutouts).slice(0, 32);
  const xs = [...new Set([0, widthMm, ...cutouts.flatMap((cutout) => [cutout.xMm, cutout.xMm + cutout.widthMm])])]
    .sort((a, b) => a - b);
  const ys = [...new Set([0, heightMm, ...cutouts.flatMap((cutout) => [cutout.yMm, cutout.yMm + cutout.heightMm])])]
    .sort((a, b) => a - b);
  const cells: Array<FittedPanelSolidCell & { xi: number; yi: number }> = [];
  const occupied = new Set<string>();
  for (let xi = 0; xi < xs.length - 1; xi += 1) {
    for (let yi = 0; yi < ys.length - 1; yi += 1) {
      const left = xs[xi];
      const right = xs[xi + 1];
      const bottom = ys[yi];
      const top = ys[yi + 1];
      if (right - left < 0.1 || top - bottom < 0.1) continue;
      const centerX = (left + right) / 2;
      const centerY = (bottom + top) / 2;
      if (cutouts.some((cutout) => (
        centerX > cutout.xMm - 0.001
        && centerX < cutout.xMm + cutout.widthMm + 0.001
        && centerY > cutout.yMm - 0.001
        && centerY < cutout.yMm + cutout.heightMm + 0.001
      ))) continue;
      cells.push({
        xi,
        yi,
        centerXmm: round(centerX - widthMm / 2),
        centerYmm: round(centerY - heightMm / 2),
        widthMm: round(right - left),
        heightMm: round(top - bottom),
      });
      occupied.add(`${xi}:${yi}`);
    }
  }
  let componentCount = 0;
  const unseen = new Set(occupied);
  while (unseen.size) {
    componentCount += 1;
    const start = unseen.values().next().value as string;
    const queue = [start];
    unseen.delete(start);
    while (queue.length) {
      const [xi, yi] = queue.shift()!.split(':').map(Number);
      for (const [nextX, nextY] of [[xi - 1, yi], [xi + 1, yi], [xi, yi - 1], [xi, yi + 1]]) {
        const key = `${nextX}:${nextY}`;
        if (!unseen.has(key)) continue;
        unseen.delete(key);
        queue.push(key);
      }
    }
  }
  const solidArea = cells.reduce((sum, cell) => sum + cell.widthMm * cell.heightMm, 0);
  return {
    cells: cells.map(({ xi: _xi, yi: _yi, ...cell }) => cell),
    componentCount,
    solidAreaRatio: round(solidArea / (widthMm * heightMm), 4),
  };
};

const positiveRect = (rect: FittedPanelRectMm) => rect.right > rect.left && rect.top > rect.bottom;

export const calculateFittedPanelPlan = (
  parameters: FittedPanelParameters,
  opening: FittedPanelOpening,
  obstacles: readonly FittedPanelObstacle[],
): FittedPanelPlan => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const thickness = finite(parameters.thicknessMm) ? parameters.thicknessMm : 0;
  const clearGap = finite(parameters.clearGapMm) ? parameters.clearGapMm : 0;
  const recess = finite(parameters.recessMm) ? parameters.recessMm : 0;
  const overlayGap = finite(parameters.overlayEdgeGapMm) ? parameters.overlayEdgeGapMm : 0;
  const avoidanceClearance = finite(parameters.avoidanceClearanceMm) ? parameters.avoidanceClearanceMm : 0;
  if (parameters.openingKey !== opening.key) errors.push('所选框口已经变化，请重新选择。');
  if (thickness < 1 || thickness > 60) errors.push('板厚须在 1–60mm 之间。');
  if (!FITTED_PANEL_MATERIAL_THICKNESSES[parameters.materialKind]?.includes(thickness)) {
    errors.push('所选板厚不在当前材料记录的可用规格中。');
  }
  if (clearGap < 0 || clearGap > 30) errors.push('净开口边缝须在 0–30mm 之间。');
  if (recess < 0 || recess > 100) errors.push('板面后退量须在 0–100mm 之间。');
  if (overlayGap < 0 || overlayGap > 30) errors.push('外挂边缘留缝须在 0–30mm 之间。');
  if (avoidanceClearance < 0 || avoidanceClearance > 10) errors.push('避让设计余量须在 0–10mm 之间。');

  const base = parameters.mountMode === 'overlay' ? opening.outer : opening.inner;
  const edgeInset = parameters.mountMode === 'overlay' ? overlayGap : clearGap;
  const bounds = {
    left: base.left + edgeInset,
    right: base.right - edgeInset,
    bottom: base.bottom + edgeInset,
    top: base.top - edgeInset,
  };
  if (!positiveRect(bounds)) errors.push('当前间隙大于可用框口，无法形成板件。');
  const widthMm = Math.max(0, bounds.right - bounds.left);
  const heightMm = Math.max(0, bounds.top - bounds.bottom);
  if (parameters.materialKind === 'marine_board'
    && (Math.max(widthMm, heightMm) > 2440.001 || Math.min(widthMm, heightMm) > 1220.001)) {
    errors.push('板件超出当前 2440×1220mm 海洋板单张包络（允许旋转排版），请拆板或缩小框口。');
  }
  if ((parameters.materialKind === 'plate' || parameters.materialKind === 'pegboard')
    && (widthMm > 2400.001 || heightMm > 2400.001)) {
    errors.push('板件超出当前 2400×2400mm 设计包络，请拆板或缩小框口。');
  }
  const frontFaceZ = parameters.mountMode === 'overlay'
    ? opening.frontZ
    : opening.frontZ - (parameters.mountMode === 'recessed' ? recess : 0);
  const centerZ = parameters.mountMode === 'overlay'
    ? frontFaceZ + thickness / 2
    : frontFaceZ - thickness / 2;
  const boardRear = centerZ - thickness / 2;
  const boardFront = centerZ + thickness / 2;
  const boundaryIds = new Set(opening.profileIds);
  const cutouts: FittedPanelCutout[] = [];
  const unresolvedObstacles: string[] = [];

  if (parameters.autoAvoidance && widthMm > 0 && heightMm > 0) {
    obstacles.forEach((obstacle) => {
      if (boundaryIds.has(obstacle.id)) return;
      const zOverlap = Math.min(boardFront, obstacle.bounds.front) - Math.max(boardRear, obstacle.bounds.rear);
      const xOverlap = Math.min(bounds.right, obstacle.bounds.right) - Math.max(bounds.left, obstacle.bounds.left);
      const yOverlap = Math.min(bounds.top, obstacle.bounds.top) - Math.max(bounds.bottom, obstacle.bounds.bottom);
      if (zOverlap <= 0.05 || xOverlap <= 0.05 || yOverlap <= 0.05) return;
      if (!obstacle.axisAligned) {
        unresolvedObstacles.push(`${obstacle.label}（斜置/非正交，未自动切除）`);
        return;
      }
      const left = clamp(obstacle.bounds.left - avoidanceClearance, bounds.left, bounds.right);
      const right = clamp(obstacle.bounds.right + avoidanceClearance, bounds.left, bounds.right);
      const bottom = clamp(obstacle.bounds.bottom - avoidanceClearance, bounds.bottom, bounds.top);
      const top = clamp(obstacle.bounds.top + avoidanceClearance, bounds.bottom, bounds.top);
      if (right - left < 0.1 || top - bottom < 0.1) return;
      cutouts.push({
        xMm: round(left - bounds.left),
        yMm: round(bottom - bounds.bottom),
        widthMm: round(right - left),
        heightMm: round(top - bottom),
        sourceId: obstacle.id,
        sourceLabel: obstacle.label,
        sourceKind: obstacle.kind,
        touchesEdge: left <= bounds.left + 0.01 || right >= bounds.right - 0.01
          || bottom <= bounds.bottom + 0.01 || top >= bounds.top - 0.01,
      });
    });
  }
  const normalizedCutouts = normalizeCutouts(widthMm, heightMm, cutouts).slice(0, 32);
  if (cutouts.length > 32) unresolvedObstacles.push(`另有 ${cutouts.length - 32} 处相交超过首版自动避让上限`);
  const solid = buildFittedPanelSolidCells(widthMm, heightMm, normalizedCutouts);
  if (solid.componentCount > 1) errors.push('自动避让会把板件切成多个不相连区域，请调整安装面或改为人工拆板。');
  if (!solid.cells.length && widthMm > 0 && heightMm > 0) errors.push('避让范围覆盖了整块板件，无法生成。');
  if (parameters.mountMode !== 'overlay' && boardRear < opening.rearZ - 0.01) {
    errors.push('当前板厚与后退量会使板件越过框架后表面，请减小后退量/板厚或改用框外覆盖。');
  }
  if (normalizedCutouts.length) warnings.push('避让会改变板件净截面；最小余料、刚度、圆角与加工方式需要人工复核。');
  if (unresolvedObstacles.length) warnings.push('存在无法用正交矩形可靠表达的阻挡，未自动生成其避让。');
  if (parameters.mountMode === 'recessed') warnings.push('内置深度只定位板面，不代表型材已有对应槽口或支撑。');
  if (parameters.mountMode === 'front_flush') warnings.push('齐面只保证板面与当前框架前表面共面，固定支撑仍需另行确认。');
  if (parameters.mountMode === 'overlay') warnings.push('外挂板按框架外轮廓生成，背面固定件和开启/装入空间仍需复核。');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    bounds,
    widthMm: round(widthMm),
    heightMm: round(heightMm),
    center: [round((bounds.left + bounds.right) / 2), round((bounds.bottom + bounds.top) / 2), round(centerZ)],
    frontFaceZ: round(frontFaceZ),
    cutouts: normalizedCutouts,
    unresolvedObstacles,
    solidCells: solid.cells,
    solidComponentCount: solid.componentCount,
    solidAreaRatio: solid.solidAreaRatio,
  };
};

export const createFittedPanelDraftMarker = (
  parameters: FittedPanelParameters,
  plan: FittedPanelPlan,
): FittedPanelDraftMarker => ({
  schemaVersion: 1,
  status: 'engineering_draft',
  exactFit: false,
  requiresPhysicalReview: true,
  openingKey: parameters.openingKey,
  mountMode: parameters.mountMode,
  materialKind: parameters.materialKind,
  clearGapMm: round(parameters.clearGapMm),
  recessMm: round(parameters.recessMm),
  overlayEdgeGapMm: round(parameters.overlayEdgeGapMm),
  avoidanceMode: parameters.autoAvoidance ? 'actual_intersection' : 'off',
  avoidanceClearanceMm: round(parameters.avoidanceClearanceMm),
  cutouts: plan.cutouts,
  unresolvedObstacles: plan.unresolvedObstacles,
});

export const hasFittedPanelDraftMarker = (item: unknown) => Boolean(
  item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'fittedPanel'),
);

export const readFittedPanelDraftMarker = (
  raw: unknown,
  widthMm: number,
  heightMm: number,
): FittedPanelDraftMarker | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const marker = raw as Partial<FittedPanelDraftMarker>;
  if (marker.schemaVersion !== 1
    || !['recessed', 'front_flush', 'overlay'].includes(String(marker.mountMode))
    || !['marine_board', 'plate', 'pegboard'].includes(String(marker.materialKind))
    || !Array.isArray(marker.cutouts)) return null;
  const cutouts = normalizeCutouts(widthMm, heightMm, marker.cutouts.flatMap((cutout): FittedPanelCutout[] => {
    if (!cutout || typeof cutout !== 'object'
      || !finite((cutout as FittedPanelCutout).xMm)
      || !finite((cutout as FittedPanelCutout).yMm)
      || !finite((cutout as FittedPanelCutout).widthMm)
      || !finite((cutout as FittedPanelCutout).heightMm)) return [];
    const rawCutout = cutout as Partial<FittedPanelCutout>;
    return [{
      xMm: rawCutout.xMm!,
      yMm: rawCutout.yMm!,
      widthMm: rawCutout.widthMm!,
      heightMm: rawCutout.heightMm!,
      sourceId: typeof rawCutout.sourceId === 'string' ? rawCutout.sourceId : '',
      sourceLabel: typeof rawCutout.sourceLabel === 'string' ? rawCutout.sourceLabel : '未命名相交构件',
      sourceKind: typeof rawCutout.sourceKind === 'string' ? rawCutout.sourceKind : 'unknown',
      touchesEdge: Boolean(rawCutout.touchesEdge),
    }];
  })).slice(0, 32);
  return {
    schemaVersion: 1,
    status: 'engineering_draft',
    exactFit: false,
    requiresPhysicalReview: true,
    openingKey: typeof marker.openingKey === 'string' ? marker.openingKey : '',
    mountMode: marker.mountMode as FittedPanelMountMode,
    materialKind: marker.materialKind as FittedPanelMaterialKind,
    clearGapMm: finite(marker.clearGapMm) ? marker.clearGapMm : 0,
    recessMm: finite(marker.recessMm) ? marker.recessMm : 0,
    overlayEdgeGapMm: finite(marker.overlayEdgeGapMm) ? marker.overlayEdgeGapMm : 0,
    avoidanceMode: marker.avoidanceMode === 'actual_intersection' ? 'actual_intersection' : 'off',
    avoidanceClearanceMm: finite(marker.avoidanceClearanceMm) ? marker.avoidanceClearanceMm : 0,
    cutouts,
    unresolvedObstacles: Array.isArray(marker.unresolvedObstacles)
      ? marker.unresolvedObstacles.filter((entry): entry is string => typeof entry === 'string').slice(0, 32)
      : [],
  };
};
