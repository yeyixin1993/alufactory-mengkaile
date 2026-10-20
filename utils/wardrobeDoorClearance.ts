/** Generated wardrobe clearance is reversible and follows only installed inset doors. */
export interface WardrobeDoorClearance {
  deltaZMm: number;
  deltaHeightMm: number;
  clearanceMm: number;
  applied: boolean;
  anchorDx: number;
  anchorDy: number;
  frontOffsetZ: number;
  openingWidthMm: number;
  frontRail: boolean;
}
interface ClearanceItem {
  id: string; kind: string; position: [number, number, number];
  remark?: string; width?: number; height?: number; lockedPosition?: boolean; doorOverlay?: string;
  wardrobeDoorClearance?: WardrobeDoorClearance; wardrobeFrontSetbackMm?: number;
}
export function syncWardrobeDoorClearance<T extends ClearanceItem>(items: T[]): { items: T[]; changedFrontIds: Set<string> } {
  const doors = items.filter(item => item.kind === 'cabinet_door' && item.lockedPosition && item.doorOverlay === 'inset');
  const changedFrontIds = new Set<string>();
  const result = items.map(item => {
    const rule = item.wardrobeDoorClearance;
    if (!rule || ![rule.deltaZMm, rule.deltaHeightMm, rule.clearanceMm, rule.anchorDx, rule.anchorDy, rule.frontOffsetZ, rule.openingWidthMm].every(Number.isFinite)) return item;
    const centerX = item.position[0] + rule.anchorDx;
    const centerY = item.position[1] + rule.anchorDy;
    const frontZ = item.position[2] - (rule.applied ? rule.deltaZMm : 0) + rule.frontOffsetZ;
    const applied = doors.some(door => Math.abs(door.position[2] - frontZ) <= 40
      && Math.abs(door.position[1] - centerY) < (door.height || 0) / 2
      && Math.min(centerX + rule.openingWidthMm / 2, door.position[0] + (door.width || 0) / 2)
        - Math.max(centerX - rule.openingWidthMm / 2, door.position[0] - (door.width || 0) / 2) > 3);
    if (applied === rule.applied) return item;
    const sign = applied ? 1 : -1;
    if (rule.frontRail) changedFrontIds.add(item.id);
    return { ...item,
      position: [item.position[0], item.position[1], Number((item.position[2] + sign * rule.deltaZMm).toFixed(4))] as [number, number, number],
      ...(rule.deltaHeightMm && item.height !== undefined ? { height: Math.round(item.height + sign * rule.deltaHeightMm) } : {}),
      ...(rule.frontRail ? { wardrobeFrontSetbackMm: applied ? rule.clearanceMm : undefined } : {}),
      remark: `${(item.remark || '').replace(/；柜门联动：[^；]*/g, '')}；柜门联动：${applied ? `大弯门已安装，本层内退${rule.clearanceMm}mm，按当前尺寸加工` : '本层已恢复齐平，按当前尺寸加工'}`,
      wardrobeDoorClearance: { ...rule, applied },
    };
  });
  return { items: result, changedFrontIds };
}
