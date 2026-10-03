import { buildFittedPanelSolidCells, type FittedPanelSolidCell } from './fittedPanelPlanner';

/**
 * Native rectangular through-cut in a board's unrotated local XY plane.
 * xMm/yMm are measured from its left/bottom edges (0,0); widthMm/heightMm
 * extend toward local +X/+Y through the entire recorded board thickness.
 * Rotation and position are applied to the resulting solid, never to these
 * cut dimensions. These are design geometry, not toolpath or cutter approval.
 */
export interface BoardCutoutMm {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  sourceId: string;
  reason: string;
  /** Captured geometry, not an approval token; any later edit invalidates the cut. */
  sourceGeometryKey: string;
  boardGeometryKey: string;
}

export interface BoardCutoutSceneItem {
  id: string;
  kind: string;
  position: readonly number[];
  rotation: readonly number[];
  width?: number;
  height?: number;
  thickness?: number;
  length?: number;
  variantId?: string;
  quantity?: number;
  lockedPosition?: boolean;
  boardCutouts?: unknown;
}

const geometryNumbers = (values: readonly number[]) => values.map((value) => round(value));
export const boardCutoutBoardGeometryKey = (board: BoardCutoutSceneItem) => JSON.stringify([
  board.kind, geometryNumbers(board.position), geometryNumbers(board.rotation),
  round(board.width || 0), round(board.height || 0), round(board.thickness || 0), round(board.quantity || 1),
]);
export const boardCutoutSourceGeometryKey = (source: BoardCutoutSceneItem) => JSON.stringify([
  source.kind, source.variantId || '', geometryNumbers(source.position),
  geometryNumbers(source.rotation), round(source.length || 0), round(source.quantity || 1),
]);

export const inspectBoardCutoutDependencies = (
  board: BoardCutoutSceneItem,
  scene: readonly BoardCutoutSceneItem[],
): { valid: boolean; issues: string[] } => {
  if (!hasBoardCutouts(board)) return { valid: true, issues: [] };
  const cutouts = readBoardCutouts(board.boardCutouts, board.width || 0, board.height || 0);
  if (!cutouts) return { valid: false, issues: [`板件 ${board.id} 的切口记录无效，旧切口不得显示为实体。`] };
  const issues: string[] = [];
  const currentBoardKey = boardCutoutBoardGeometryKey(board);
  cutouts.forEach((cutout) => {
    if (cutout.boardGeometryKey !== currentBoardKey) {
      issues.push(`板件 ${board.id} 的位置、旋转或尺寸已变化，切口需重新生成。`);
    }
    const source = scene.find((item) => item.id === cutout.sourceId && item.kind === 'profile');
    if (!source) {
      issues.push(`板件 ${board.id} 的切口来源后柱 ${cutout.sourceId} 已不存在，切口需重新生成。`);
    } else if (cutout.sourceGeometryKey !== boardCutoutSourceGeometryKey(source)) {
      issues.push(`板件 ${board.id} 的切口来源后柱 ${cutout.sourceId} 已变更，切口需重新生成。`);
    }
  });
  return { valid: issues.length === 0, issues: [...new Set(issues)] };
};

/** Ordinary editing may remove a board, but cannot silently reshape/unlock it. */
export const isProtectedBoardCutoutMutation = (
  before: readonly BoardCutoutSceneItem[],
  after: readonly BoardCutoutSceneItem[],
): boolean => before.some((board) => {
  if (!hasBoardCutouts(board) || !board.lockedPosition) return false;
  const candidate = after.find((item) => item.id === board.id);
  if (!candidate) return false;
  return !hasBoardCutouts(candidate)
    || boardCutoutBoardGeometryKey(candidate) !== boardCutoutBoardGeometryKey(board)
    || candidate.quantity !== board.quantity
    || candidate.lockedPosition !== board.lockedPosition
    || JSON.stringify(candidate.boardCutouts) !== JSON.stringify(board.boardCutouts);
}) || after.some((candidate) => hasBoardCutouts(candidate)
  && !before.some((item) => item.id === candidate.id)
  && before.some((board) => hasBoardCutouts(board)
    && JSON.stringify(board.boardCutouts) === JSON.stringify(candidate.boardCutouts)));

export const BOARD_CUTOUT_MANUFACTURING_HOLD = '异形板切口已作为真实板件几何保存，但最小余料、刀具半径、装配间隙与固定方式尚未实物校核；当前不能直接生成生产资料。';

const round = (value: number) => Number(value.toFixed(3));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const hasBoardCutouts = (item: unknown): boolean => Boolean(
  item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'boardCutouts'),
);

/** Reject, rather than clip, edited/imported cuts outside the current stock. */
export const readBoardCutouts = (
  raw: unknown,
  widthMm: number,
  heightMm: number,
): BoardCutoutMm[] | null => {
  if (!finite(widthMm) || !finite(heightMm) || widthMm <= 0 || heightMm <= 0
    || !Array.isArray(raw) || raw.length < 1 || raw.length > 32) return null;
  const parsed: BoardCutoutMm[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const cutout = entry as Partial<BoardCutoutMm>;
    if (![cutout.xMm, cutout.yMm, cutout.widthMm, cutout.heightMm].every(finite)
      || cutout.xMm! < 0 || cutout.yMm! < 0
      || cutout.widthMm! < 0.1 || cutout.heightMm! < 0.1
      || cutout.xMm! + cutout.widthMm! > widthMm + 0.001
      || cutout.yMm! + cutout.heightMm! > heightMm + 0.001
      || typeof cutout.sourceId !== 'string' || !cutout.sourceId.trim()
      || typeof cutout.reason !== 'string' || !cutout.reason.trim()
      || typeof cutout.sourceGeometryKey !== 'string' || !cutout.sourceGeometryKey.trim()
      || typeof cutout.boardGeometryKey !== 'string' || !cutout.boardGeometryKey.trim()) return null;
    parsed.push({
      xMm: round(cutout.xMm!),
      yMm: round(cutout.yMm!),
      widthMm: round(cutout.widthMm!),
      heightMm: round(cutout.heightMm!),
      sourceId: cutout.sourceId.trim(),
      reason: cutout.reason.trim(),
      sourceGeometryKey: cutout.sourceGeometryKey,
      boardGeometryKey: cutout.boardGeometryKey,
    });
  }
  const solid = buildBoardSolidCells(widthMm, heightMm, parsed);
  return solid.cells.length && solid.componentCount === 1 ? parsed : null;
};

export const buildBoardSolidCells = (
  widthMm: number,
  heightMm: number,
  cutouts: readonly BoardCutoutMm[],
): { cells: FittedPanelSolidCell[]; componentCount: number; solidAreaRatio: number } => (
  buildFittedPanelSolidCells(widthMm, heightMm, cutouts.map((cutout) => ({
    ...cutout,
    sourceLabel: cutout.reason,
    sourceKind: 'profile',
    touchesEdge: cutout.xMm <= 0.001 || cutout.yMm <= 0.001
      || cutout.xMm + cutout.widthMm >= widthMm - 0.001
      || cutout.yMm + cutout.heightMm >= heightMm - 0.001,
  })))
);
