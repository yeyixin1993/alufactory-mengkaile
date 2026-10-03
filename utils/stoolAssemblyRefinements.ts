import { Euler, Vector3 } from 'three';
import type { ParametricSceneItem } from './parametricFurniture';
import type { StoolParameters } from './parametricStool';
import { STOOL_ACCESSORY_SOURCE_SHA256 } from '../data/stoolAccessoryCatalog';

/** Measured from the archived mesh, before applying its floor offset. */
export const STOOL_ASSEMBLY_MEASUREMENTS = {
  groundOffsetMm: 61.15893872280715,
  shaftCenterHeightMm: 90,
  shaftSupportBoreCenterLocalMm: [0, 0, -1.5] as const,
  handleHolePitchMm: 112,
  handleHoleDiameterMm: 5.4,
  handleRearPlaneLocalY: -26,
  handleHoleCenterLocalZ: -13.5,
  overallDepthBeyondFrameMm: 52,
} as const;

type Vector = [number, number, number];
const round = (value: number) => Number(value.toFixed(6));
const rotationOf = (item: ParametricSceneItem) => new Euler(
  ...item.rotation.map((angle) => angle * Math.PI / 180) as Vector, 'XYZ',
);
const appendRemark = (remark: string | undefined, note: string) => remark?.includes(note)
  ? remark : [remark, note].filter(Boolean).join('；');

/**
 * Applies measured assembly corrections after source parametrisation and its
 * floor offset. Source meshes, source records and the archived arrangement stay
 * untouched. This is idempotent and does not add procurement or fastening claims.
 */
export function refineStoolSourceAssembly(
  items: readonly ParametricSceneItem[], parameters: StoolParameters,
): ParametricSceneItem[] {
  const dw = parameters.widthMm - 360;
  const dd = parameters.depthMm - 360;
  const dh = parameters.heightMm - 500;
  const floor = STOOL_ASSEMBLY_MEASUREMENTS.groundOffsetMm;
  return items.map((item) => {
    const source = item.sourceMesh?.source;
    if (!source || source.fileSha256 !== STOOL_ACCESSORY_SOURCE_SHA256
      || !item.id.startsWith('parametric-stool-')) return item;
    if (source.instancePath === 'root/instances-41') {
      // Two actual planar mounting pads, Ø5.4 holes at local X ±56.
      return {
        ...item,
        position: [0, round(301.5 + dh + floor), round(206 + dd / 2)] as Vector,
        remark: appendRemark(item.remark,
          '装配校正：按源网格两安装座背面贴合前梁，实测112mm孔距对称于中心、孔中心对齐前梁槽线；网格与源记录未改'),
      };
    }
    const match = /^root\/instances-([1-4])(?:\/instances-([12]))?$/.exec(source.instancePath);
    if (!match) return item;
    const assembly = Number(match[1]);
    const alongX = assembly === 1 || assembly === 4;
    const lengthAxis = alongX ? 0 : 2;
    const crossAxis = alongX ? 2 : 0;
    const crossSign = assembly === 1 || assembly === 3 ? -1 : 1;
    const desired = new Vector3();
    desired.y = 90 + floor;
    desired.setComponent(crossAxis, crossSign * (165 + (alongX ? dd : dw) / 2));
    const isSupport = match[2] !== undefined;
    if (isSupport) {
      desired.setComponent(lengthAxis, (match[2] === '1' ? 1 : -1) * (143.5 + (alongX ? dw : dd) / 2));
      const measuredBoreOffset = new Vector3(0, 0, -1.5).applyEuler(rotationOf(item));
      desired.sub(measuredBoreOffset);
    }
    return {
      ...item,
      position: desired.toArray().map(round) as Vector,
      remark: appendRemark(item.remark, isSupport
        ? '装配校正：按源网格Ø12孔壁中心与光轴同轴，支座背面贴立柱内侧、36mm安装孔距对齐槽线；网格与源记录未改'
        : '装配校正：光轴沿长轴居中，与两端源支座同轴；保留原287.3mm及参数增量，两端等深进入6.65mm；源记录未改'),
    };
  });
}
