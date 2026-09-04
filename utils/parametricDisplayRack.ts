import type { DrillHole, ProfileSide } from '../types';
import type { ParametricSceneItem, ParametricTemplatePayload } from './parametricFurniture';
import { DISPLAY_RACK_COMPONENT_CATALOG } from '../data/displayRackComponentCatalog';

export const DISPLAY_RACK_3_BASELINE = {
  widthMm: 800,
  heightMm: 2000,
  depthMm: 450,
  baseCabinetHeightMm: 824,
  upperLevels: 3,
  lowerLevels: 5,
} as const;

export const DISPLAY_RACK_3_LIMITS = {
  widthMm: { min: 400, max: 1500, step: 1 },
  heightMm: { min: 1500, max: 3000, step: 1 },
  depthMm: { min: 350, max: 750, step: 1 },
  baseCabinetHeightMm: { min: 600, max: 1400, step: 1 },
  upperLevels: { min: 1, max: 5, step: 1 },
  lowerLevels: { min: 3, max: 7, step: 1 },
} as const;

const FIXED = {
  drawerGapMm: 25,
  upperShelfDepthMm: 68,
  upperDisplayHeightMm: 300,
  upperAssemblyTiltDeg: 20,
  upperShelfCenterXMm: 164.24,
  upperShelfCenterZOffsetMm: 5.09,
  upperDisplayCenterXMm: 86.37,
  upperDisplayCenterZOffsetMm: 145.95,
  shaftCenterXMm: 15,
  shaftLevelOffsetMm: 257.31,
  upperTierBottomClearanceMm: 206.06,
  upperTierMinimumBottomClearanceMm: 29.05,
  upperTierTopClearanceMm: 320,
  minimumUpperPitchMm: 324.9,
  minimumDrawerPanelHeightMm: 50,
} as const;

export interface DisplayRack3Parameters {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  baseCabinetHeightMm: number;
  upperLevels: number;
  lowerLevels: number;
  trackLayoutMode?: 'auto' | 'custom';
  trackHeightsMm?: number[];
}

export interface DisplayRack3Layout extends DisplayRack3Parameters {
  dividerHeightMm: number;
  topRailHeightMm: number;
  upperTierHeightsMm: number[];
  upperPitchMm: number;
  drawerPitchMm: number;
  drawerHeightMm: number;
  drawerRailHeightsMm: number[];
  drawerCenterHeightsMm: number[];
  counts: {
    profiles: number;
    panels: number;
    shafts: number;
    supports: number;
    drawerSlides: number;
    total: number;
  };
}

export interface DisplayRack3Validation {
  valid: boolean;
  message: string;
  layout?: DisplayRack3Layout;
}

const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const GEOMETRY_EPSILON_MM = 1e-6;

const assertSteppedValue = (
  key: keyof typeof DISPLAY_RACK_3_LIMITS,
  value: number,
  label: string,
) => {
  const rule = DISPLAY_RACK_3_LIMITS[key];
  if (!Number.isFinite(value)) throw new Error(`请输入${label}。`);
  if (value < rule.min || value > rule.max) {
    throw new Error(`${label}必须在${rule.min}～${rule.max}之间。`);
  }
  if ((key === 'upperLevels' || key === 'lowerLevels') && !Number.isInteger(value)) {
    throw new Error(`${label}必须是整数。`);
  }
  const steps = (value - rule.min) / rule.step;
  if (Math.abs(steps - Math.round(steps)) > 1e-6) {
    throw new Error(`${label}必须按${rule.step}递增。`);
  }
};

export const calculateDisplayRack3Layout = (
  parameters: DisplayRack3Parameters,
): DisplayRack3Layout => {
  const { widthMm, heightMm, depthMm, upperLevels, lowerLevels } = parameters;
  assertSteppedValue('widthMm', widthMm, '宽度');
  assertSteppedValue('heightMm', heightMm, '高度');
  assertSteppedValue('depthMm', depthMm, '深度');
  assertSteppedValue('baseCabinetHeightMm', parameters.baseCabinetHeightMm, '地柜高度');
  assertSteppedValue('upperLevels', upperLevels, '上部层数');
  assertSteppedValue('lowerLevels', lowerLevels, '下部层数');

  const dividerHeightMm = round(parameters.baseCabinetHeightMm);
  const topRailHeightMm = round(dividerHeightMm - 33);
  const idealUpperFirst = dividerHeightMm + FIXED.upperTierBottomClearanceMm;
  const minimumUpperFirst = dividerHeightMm + FIXED.upperTierMinimumBottomClearanceMm;
  const upperLast = heightMm - FIXED.upperTierTopClearanceMm;
  if (upperLast < minimumUpperFirst) {
    throw new Error('当前高度不足以容纳上部固定结构，请增加总高度或减少上部层数。');
  }

  const upperFirst = upperLevels === 1
    ? Math.min(idealUpperFirst, upperLast)
    : Math.min(
      idealUpperFirst,
      upperLast - FIXED.minimumUpperPitchMm * (upperLevels - 1),
    );
  if (upperFirst < minimumUpperFirst) {
    throw new Error('当前高度不足以保留上部层板与中间台面的安全间隙。');
  }
  const upperPitchMm = upperLevels === 1 ? 0 : (upperLast - upperFirst) / (upperLevels - 1);
  if (upperLevels > 1 && upperPitchMm + 1e-6 < FIXED.minimumUpperPitchMm) {
    const requiredHeight = dividerHeightMm
      + FIXED.upperTierMinimumBottomClearanceMm
      + FIXED.upperTierTopClearanceMm
      + FIXED.minimumUpperPitchMm * (upperLevels - 1);
    throw new Error(`上部${upperLevels}层在当前高度会发生板件或光轴夹具冲突；至少需要约${Math.ceil(requiredHeight)}mm总高。`);
  }
  const automaticUpperTierHeights = upperLevels === 1
    ? [round((upperFirst + upperLast) / 2)]
    : Array.from({ length: upperLevels }, (_, index) => round(upperFirst + upperPitchMm * index));
  const customTrackHeights = parameters.trackLayoutMode === 'custom'
    ? parameters.trackHeightsMm
    : undefined;
  if (parameters.trackLayoutMode === 'custom' && customTrackHeights?.length !== upperLevels) {
    throw new Error(`请为${upperLevels}层上部层板分别填写安装高度。`);
  }
  const upperTierHeightsMm = customTrackHeights
    ? customTrackHeights.map((value) => round(value))
    : automaticUpperTierHeights;
  upperTierHeightsMm.forEach((value, index) => {
    if (!Number.isFinite(value) || value < minimumUpperFirst || value > upperLast) {
      throw new Error(`第${index + 1}层板安装高度必须在${Math.ceil(minimumUpperFirst)}～${Math.floor(upperLast)}mm之间。`);
    }
    if (
      index > 0
      && value - upperTierHeightsMm[index - 1] + GEOMETRY_EPSILON_MM < FIXED.minimumUpperPitchMm
    ) {
      throw new Error(`第${index}、${index + 1}层板间距不得小于${FIXED.minimumUpperPitchMm}mm。`);
    }
  });

  const marginRatio = 25 / 36;
  const lowerSpan = dividerHeightMm - 48;
  const drawerPitchMm = lowerSpan / ((lowerLevels - 1) + marginRatio * 2);
  const drawerHeightMm = drawerPitchMm - FIXED.drawerGapMm;
  if (drawerHeightMm + 1e-6 < FIXED.minimumDrawerPanelHeightMm) {
    throw new Error(`下部${lowerLevels}层会使抽屉面板低于${FIXED.minimumDrawerPanelHeightMm}mm，请增加总高度或减少下部层数。`);
  }
  const drawerRailHeightsMm = Array.from(
    { length: lowerLevels },
    (_, index) => round(15 + marginRatio * drawerPitchMm + drawerPitchMm * index),
  );
  const drawerCenterHeightsMm = drawerRailHeightsMm.map((height) => round(height + 0.5));
  const counts = {
    profiles: 14 + lowerLevels * 2 + upperLevels * 4,
    panels: 1 + lowerLevels * 5 + upperLevels * 2,
    shafts: upperLevels,
    supports: upperLevels * 5,
    drawerSlides: lowerLevels,
    total: 0,
  };
  counts.total = counts.profiles + counts.panels + counts.shafts + counts.supports + counts.drawerSlides;

  return {
    widthMm,
    heightMm,
    depthMm,
    baseCabinetHeightMm: dividerHeightMm,
    upperLevels,
    lowerLevels,
    trackLayoutMode: parameters.trackLayoutMode || 'auto',
    trackHeightsMm: upperTierHeightsMm,
    dividerHeightMm,
    topRailHeightMm,
    upperTierHeightsMm,
    upperPitchMm: round(upperTierHeightsMm.length > 1
      ? Math.min(...upperTierHeightsMm.slice(1).map((value, index) => value - upperTierHeightsMm[index]))
      : 0),
    drawerPitchMm: round(drawerPitchMm),
    drawerHeightMm: round(drawerHeightMm),
    drawerRailHeightsMm,
    drawerCenterHeightsMm,
    counts,
  };
};

export const validateDisplayRack3Parameters = (
  parameters: DisplayRack3Parameters,
): DisplayRack3Validation => {
  try {
    return {
      valid: true,
      message: '空间校验通过：固定构件不缩放，孔位按生成后的实际结构重新计算。',
      layout: calculateDisplayRack3Layout(parameters),
    };
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error ? error.message : '参数组合无效。',
    };
  }
};

const createIdFactory = (prefix: string) => {
  let index = 0;
  return (part: string) => `${prefix}-${part}-${++index}`;
};

type SuPoint = [number, number, number];

const mapSuPoint = (
  point: SuPoint,
  widthMm: number,
  depthMm: number,
): [number, number, number] => [
  round(point[1] - widthMm / 2),
  round(point[2]),
  round(point[0] - depthMm / 2),
];

const createRackProfile = (
  id: (part: string) => string,
  widthMm: number,
  depthMm: number,
  startSu: SuPoint,
  finishSu: SuPoint,
  remark: string,
  holes: DrillHole[] = [],
): ParametricSceneItem => {
  const start = mapSuPoint(startSu, widthMm, depthMm);
  const finish = mapSuPoint(finishSu, widthMm, depthMm);
  const delta = finish.map((value, index) => value - start[index]) as [number, number, number];
  const length = Math.sqrt(delta[0] ** 2 + delta[1] ** 2 + delta[2] ** 2);
  let rotation: [number, number, number] = [0, 0, 0];
  if (Math.abs(delta[1]) > 1e-6) rotation = [0, 0, 90];
  else if (Math.abs(delta[2]) > 1e-6) rotation = [0, 90, 0];
  return {
    id: id('profile'),
    kind: 'profile',
    name: '3030',
    position: start.map((value, index) => round((value + finish[index]) / 2)) as [number, number, number],
    rotation,
    colorId: 'natural',
    quantity: 1,
    variantId: '3030',
    length: round(length),
    holes,
    tappingLeft: false,
    tappingRight: false,
    autoGenerated: true,
    lockedPosition: true,
    remark,
  };
};

const createRackPanel = (
  id: (part: string) => string,
  name: string,
  position: [number, number, number],
  width: number,
  height: number,
  rotation: [number, number, number],
  remark: string,
): ParametricSceneItem => ({
  id: id('panel'),
  kind: 'marine_board',
  name,
  position: position.map((value) => round(value)) as [number, number, number],
  rotation,
  colorId: 'wood_natural',
  quantity: 1,
  width: Math.max(1, Math.round(width)),
  height: Math.max(1, Math.round(height)),
  thickness: 18,
  autoGenerated: true,
  lockedPosition: true,
  remark,
});

const createShaftPassageHoles = (
  id: (part: string) => string,
  positions: number[],
  side: ProfileSide,
): DrillHole[] => positions.map((positionMm) => ({
  id: id('shaft-hole'),
  side,
  positionMm: Math.round(positionMm),
  type: 'through',
  diameterMm: 8,
  suppressAutoFastener: true,
  grooveIndex: 0,
  physicalGrooveIndex: 0,
}));

export const buildDisplayRack3Template = (
  parameters: DisplayRack3Parameters,
): ParametricTemplatePayload => {
  const layout = calculateDisplayRack3Layout(parameters);
  const {
    widthMm: width,
    heightMm: height,
    depthMm: depth,
    baseCabinetHeightMm,
    upperLevels,
    lowerLevels,
    dividerHeightMm: divider,
    topRailHeightMm: topRail,
  } = layout;
  const id = createIdFactory(`display-rack-3-${width}x${height}x${depth}`);
  const items: ParametricSceneItem[] = [];
  const shaftHeights = layout.upperTierHeightsMm.map((tier) => round(tier + FIXED.shaftLevelOffsetMm));

  [15, width - 15].forEach((widthStation, index) => {
    items.push(createRackProfile(
      id,
      width,
      depth,
      [15, widthStation, 0],
      [15, widthStation, height],
      `3.0展架后立柱${index + 1}；每个上层仅保留一个Ø8光轴贯通孔`,
      // The rack shaft runs along the scene X/overall-width axis. A vertical
      // profile is rotated +90 degrees around Z, so its local A/C faces are
      // the two faces pierced by that shaft. B/D are the front/rear faces and
      // were the reason the old template painted the holes in the wrong place.
      // One `through` record represents the entry and exit of one physical
      // bore; do not create a second record for the opposite face.
      createShaftPassageHoles(id, shaftHeights, 'A'),
    ));
  });
  [15, width - 15].forEach((widthStation, index) => {
    items.push(createRackProfile(
      id,
      width,
      depth,
      [depth - 15, widthStation, 0],
      [depth - 15, widthStation, divider - 18],
      `3.0展架前立柱${index + 1}`,
    ));
  });

  const lowerDepthStations = [15, ...layout.drawerRailHeightsMm, topRail];
  lowerDepthStations.forEach((heightStation, stationIndex) => {
    [15, width - 15].forEach((widthStation, sideIndex) => {
      items.push(createRackProfile(
        id,
        width,
        depth,
        [30, widthStation, heightStation],
        [depth - 30, widthStation, heightStation],
        `3.0展架下部第${stationIndex + 1}道深向梁-${sideIndex + 1}`,
      ));
    });
  });

  const lowerWidthRails: Array<[number, number, string]> = [
    [15, 15, '下部后底横梁'],
    [depth - 15, 15, '下部前底横梁'],
    [15, topRail, '下部后顶横梁'],
    [depth - 15, topRail, '下部前顶横梁'],
    [15, divider * (345 / 824), '下部后侧加强横梁'],
  ];
  lowerWidthRails.forEach(([depthStation, heightStation, name]) => {
    items.push(createRackProfile(
      id,
      width,
      depth,
      [depthStation, 30, heightStation],
      [depthStation, width - 30, heightStation],
      `3.0展架${name}`,
    ));
  });

  layout.upperTierHeightsMm.forEach((heightStation, index) => {
    const level = index + 1;
    items.push(createRackProfile(
      id, width, depth,
      [15, 30, heightStation], [15, width - 30, heightStation],
      `3.0展架上部第${level}层后横梁`,
    ));
    items.push(createRackProfile(
      id, width, depth,
      [105, 60, heightStation], [105, width - 60, heightStation],
      `3.0展架上部第${level}层前横梁`,
    ));
    [45, width - 45].forEach((widthStation, sideIndex) => {
      items.push(createRackProfile(
        id, width, depth,
        [30, widthStation, heightStation], [120, widthStation, heightStation],
        `3.0展架上部第${level}层深向梁-${sideIndex + 1}`,
      ));
    });
  });
  items.push(createRackProfile(
    id, width, depth,
    [15, 30, height - 15], [15, width - 30, height - 15],
    '3.0展架顶部后横梁',
  ));

  layout.drawerCenterHeightsMm.forEach((centerHeight, index) => {
    const level = index + 1;
    const faceHeight = layout.drawerHeightMm;
    const bottomHeight = centerHeight - faceHeight / 2 + 9;
    items.push(createRackPanel(
      id,
      `第${level}层抽屉底板`,
      [0, bottomHeight, 3],
      width - 122,
      depth - 42,
      [90, 0, 0],
      `3.0展架第${level}层完整抽屉底板`,
    ));
    items.push(createRackPanel(
      id,
      `第${level}层抽屉前板`,
      [0, centerHeight, depth / 2 - 9],
      width - 66,
      faceHeight,
      [0, 0, 0],
      `3.0展架第${level}层完整抽屉前板`,
    ));
    items.push(createRackPanel(
      id,
      `第${level}层抽屉后板`,
      [0, centerHeight, 15 - depth / 2],
      width - 122,
      faceHeight,
      [0, 0, 0],
      `3.0展架第${level}层完整抽屉后板`,
    ));
    [-1, 1].forEach((side, sideIndex) => {
      items.push(createRackPanel(
        id,
        `第${level}层抽屉侧板-${sideIndex + 1}`,
        [side * (width / 2 - 52), centerHeight, -6],
        depth - 24,
        faceHeight,
        [0, 90, 0],
        `3.0展架第${level}层完整抽屉${side < 0 ? '左' : '右'}侧板`,
      ));
    });
  });
  items.push(createRackPanel(
    id,
    '上下模块分界台面',
    [0, divider - 9, 0],
    width,
    depth,
    [90, 0, 0],
    '3.0展架上下模块分界18mm海洋板台面',
  ));

  layout.upperTierHeightsMm.forEach((heightStation, index) => {
    const level = index + 1;
    items.push(createRackPanel(
      id,
      `第${level}层展示层板`,
      [0, heightStation + FIXED.upperShelfCenterZOffsetMm, FIXED.upperShelfCenterXMm - depth / 2],
      width - 60,
      FIXED.upperShelfDepthMm,
      [70, 0, 0],
      `3.0母版第${level}层展示层板；与挡板组成刚性L形组件并固定斜装${FIXED.upperAssemblyTiltDeg}°`,
    ));
    items.push(createRackPanel(
      id,
      `第${level}层展示挡板`,
      [0, heightStation + FIXED.upperDisplayCenterZOffsetMm, FIXED.upperDisplayCenterXMm - depth / 2],
      width - 60,
      FIXED.upperDisplayHeightMm,
      [160, 0, 0],
      `3.0母版第${level}层展示挡板；板面固定70°并与层板保持L形连接`,
    ));
  });

  layout.upperTierHeightsMm.forEach((tierHeight, index) => {
    const level = index + 1;
    const shaftHeight = round(tierHeight + FIXED.shaftLevelOffsetMm);
    const shaftCatalog = DISPLAY_RACK_COMPONENT_CATALOG.SHAFT_8;
    items.push({
      id: id('shaft'),
      kind: 'shelf_support',
      name: `第${level}层Ø8直线光轴`,
      position: [0, shaftHeight, FIXED.shaftCenterXMm - depth / 2],
      rotation: [0, 0, 0],
      colorId: 'natural',
      quantity: 1,
      length: width,
      width: shaftCatalog.diameterMm,
      height: 8,
      thickness: width,
      shelfSupportType: 'linear_shaft',
      shaftDiameterMm: shaftCatalog.diameterMm,
      accessoryPrice: round((width / 1000) * shaftCatalog.unitPriceCny, 2),
      accessoryProfileSize: '3030',
      autoGenerated: true,
      lockedPosition: true,
      remark: `3.0展架第${level}层Ø8直线光轴；长度随整体宽度变化，直径固定不缩放`,
    });

    [15, width - 15].forEach((station, supportIndex) => {
      items.push({
        id: id('shf8'),
        kind: 'shelf_support',
        name: `第${level}层SHF8支座-${supportIndex + 1}`,
        position: [station - width / 2, shaftHeight, FIXED.shaftCenterXMm - depth / 2],
        rotation: [0, 0, 0],
        colorId: 'natural',
        quantity: 1,
        width: DISPLAY_RACK_COMPONENT_CATALOG.SHF8.dimensionsMm[0],
        height: DISPLAY_RACK_COMPONENT_CATALOG.SHF8.dimensionsMm[1],
        thickness: DISPLAY_RACK_COMPONENT_CATALOG.SHF8.dimensionsMm[2],
        shelfSupportType: 'shaft_support_shf8',
        fixedReferenceId: 'MODEL_REF_SHF8_SUPPORT',
        shaftDiameterMm: 8,
        accessoryPrice: DISPLAY_RACK_COMPONENT_CATALOG.SHF8.unitPriceCny,
        accessoryProfileSize: '3030',
        autoGenerated: true,
        lockedPosition: true,
        remark: `3.0展架第${level}层SHF8法兰式光轴支座；固定库1:1定尺件`,
      });
    });
    [42, width / 2, width - 42].forEach((station, supportIndex) => {
      items.push({
        id: id('sk8'),
        kind: 'shelf_support',
        name: `第${level}层SK8支座-${supportIndex + 1}`,
        position: [station - width / 2, shaftHeight, FIXED.shaftCenterXMm - depth / 2],
        rotation: [0, 0, 0],
        colorId: 'natural',
        quantity: 1,
        width: DISPLAY_RACK_COMPONENT_CATALOG.SK8.dimensionsMm[0],
        height: DISPLAY_RACK_COMPONENT_CATALOG.SK8.dimensionsMm[1],
        thickness: DISPLAY_RACK_COMPONENT_CATALOG.SK8.dimensionsMm[2],
        shelfSupportType: 'shaft_support_sk8',
        fixedReferenceId: 'MODEL_REF_SK8_SUPPORT',
        shaftDiameterMm: 8,
        accessoryPrice: DISPLAY_RACK_COMPONENT_CATALOG.SK8.unitPriceCny,
        accessoryProfileSize: '3030',
        autoGenerated: true,
        lockedPosition: true,
        remark: `3.0展架第${level}层SK8单轴支座；固定库1:1定尺件`,
      });
    });
  });

  const slideCatalog = DISPLAY_RACK_COMPONENT_CATALOG.DRAWER_SLIDE_PAIR;
  const slideOption = slideCatalog.lengthOptions.find((option) => option.lengthMm <= depth - 50)
    || slideCatalog.lengthOptions[slideCatalog.lengthOptions.length - 1];
  const slideLength = slideOption.lengthMm;
  layout.drawerCenterHeightsMm.forEach((centerHeight, index) => {
    const level = index + 1;
    const slideCenterHeight = round(centerHeight - layout.drawerHeightMm / 2 + slideCatalog.railHeightMm / 2 + 2.5);
    items.push({
      id: id('drawer-slide'),
      kind: 'shelf_support',
      name: `第${level}层抽屉滑轨套装`,
      position: [0, slideCenterHeight, round(depth / 2 - 30 - slideLength / 2)],
      rotation: [0, 0, 0],
      colorId: 'natural',
      quantity: 1,
      length: slideLength,
      // Width is the centre distance between the left/right rails. One scene
      // item and one BOM row still represent one complete paired set.
      width: round(width - 73),
      height: slideCatalog.railHeightMm,
      thickness: slideLength,
      shelfSupportType: 'drawer_slide_pair',
      accessoryPrice: slideOption.unitPriceCny,
      accessoryProfileSize: '3030',
      autoGenerated: true,
      lockedPosition: true,
      remark: `3.0展架第${level}层三节滚珠抽屉滑轨；一套含左轨和右轨，单侧安装间隙固定${slideCatalog.sideClearanceMm}mm，标准长度${slideLength}mm，单价¥${slideOption.unitPriceCny}/套`,
    });
  });

  if (items.filter((item) => item.kind === 'profile').length !== layout.counts.profiles
      || items.filter((item) => item.kind === 'marine_board').length !== layout.counts.panels
      || items.filter((item) => item.shelfSupportType === 'linear_shaft').length !== layout.counts.shafts
      || items.filter((item) => item.shelfSupportType?.startsWith('shaft_support_')).length !== layout.counts.supports
      || items.filter((item) => item.shelfSupportType === 'drawer_slide_pair').length !== layout.counts.drawerSlides
      || items.length !== layout.counts.total) {
    throw new Error('3.0展架生成数量自检失败，请不要使用当前结果。');
  }

  return {
    schemaVersion: 1,
    source: 'display_rack_3_0',
    createdAt: new Date().toISOString(),
    summary: {
      template: 'YEZONG_DISPLAY_RACK_3_0',
      widthMm: width,
      heightMm: height,
      depthMm: depth,
      baseCabinetHeightMm,
      upperLevels,
      lowerLevels,
      trackLayoutMode: layout.trackLayoutMode || 'auto',
      profileCount: layout.counts.profiles,
      panelCount: layout.counts.panels,
      shaftCount: layout.counts.shafts,
      supportCount: layout.counts.supports,
      drawerSlideSetCount: layout.counts.drawerSlides,
      totalCount: layout.counts.total,
      profileVariant: '3030',
      panelThicknessMm: 18,
      shaftDiameterMm: 8,
      upperAssemblyTiltDeg: FIXED.upperAssemblyTiltDeg,
    },
    items,
  };
};
