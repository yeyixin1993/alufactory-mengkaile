import type { ParametricSceneItem } from './parametricFurniture';

/** Shared 3030 cabinet skeleton: continuous posts, rails between post faces.
 * Stations are profile centre lines in mm. Machining is resolved by the
 * designer's shared cabinet connection pipeline after boards are present.
 */
export const build3030CabinetFrame = ({
  boundaryXs, frontZ, backZ, frontPostHeight, backPostHeight, depthLevels,
  widthLevels, createProfile,
}: {
  boundaryXs: number[];
  frontZ: number;
  backZ: number;
  frontPostHeight: number;
  backPostHeight: number;
  depthLevels: number[];
  widthLevels: Array<{ z: number; y: number; label: string }>;
  createProfile: (start: [number, number, number], end: [number, number, number], label: string) => ParametricSceneItem;
}): ParametricSceneItem[] => {
  const items: ParametricSceneItem[] = [];
  const levelAt = (y: number): ParametricSceneItem['cabinetFrameLevel'] => (
    Math.abs(y - depthLevels[0]) < 0.01 ? 'bottom'
      : Math.abs(y - depthLevels[depthLevels.length - 1]) < 0.01 ? 'top' : 'storage'
  );
  [backZ, frontZ].forEach((z, side) => boundaryXs.forEach((x, boundary) => {
    items.push(createProfile([x, 0, z], [x, side === 0 ? backPostHeight : frontPostHeight, z], `${side === 0 ? '后' : '前'}立柱${boundary + 1}`));
  }));
  depthLevels.forEach((y, level) => boundaryXs.forEach((x, boundary) => {
    items.push({ ...createProfile([x, y, backZ + 15], [x, y, frontZ - 15], `下部第${level + 1}道深向梁-${boundary + 1}`), cabinetFrameLevel: levelAt(y) });
  }));
  widthLevels.forEach(({ z, y, label }) => boundaryXs.slice(0, -1).forEach((x, column) => {
    items.push({ ...createProfile([x + 15, y, z], [boundaryXs[column + 1] - 15, y, z], `${label}${boundaryXs.length > 2 ? `第${column + 1}列` : ''}`), cabinetFrameLevel: levelAt(y) });
  }));
  return items;
};
