import { DrillHole, ProfileFinish, ProfileSide } from '../types';

export type ParametricFurnitureSource = 'calligraphy_cabinet' | 'wardrobe';

export type ParametricItemKind =
  | 'profile'
  | 'marine_board'
  | 'shelf_support';

export interface ParametricSceneItem {
  id: string;
  kind: ParametricItemKind;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  colorId: string;
  quantity: number;
  variantId?: string;
  length?: number;
  width?: number;
  height?: number;
  thickness?: number;
  holes?: DrillHole[];
  tappingLeft?: boolean;
  tappingRight?: boolean;
  finish?: ProfileFinish;
  accessoryPrice?: number;
  accessoryProfileSize?: '2020';
  remark?: string;
}

export interface ParametricTemplatePayload {
  schemaVersion: 1;
  source: ParametricFurnitureSource;
  createdAt: string;
  summary: Record<string, number | string>;
  items: ParametricSceneItem[];
}

export const DIY_TEMPLATE_STORAGE_PREFIX = 'mengkaile_diy_template_v1:';
export const MAX_FURNITURE_PROFILE_MM = 3000;

export const CALLIGRAPHY_BASKET_WIDTH_MM = 300;
export const CALLIGRAPHY_BASKET_DEPTH_MM = 420;
export const CALLIGRAPHY_BASKET_HEIGHT_MM = 100;
export const CALLIGRAPHY_LAYER_PITCH_MM = 130;
export const CALLIGRAPHY_OUTER_DEPTH_MM = 460;
export const CALLIGRAPHY_PROFILE_MM = 20;
export const CALLIGRAPHY_MAX_LENGTH_MM = 2440;

export const SHELF_SUPPORT_PRICE_PER_METER: Record<ProfileFinish, number> = {
  oxidized: 8,
  electrophoretic: 10,
  powder: 12,
};

export const getShelfSupportUnitPrice = (lengthMm: number, finish: ProfileFinish) => (
  Number(((Math.max(0, lengthMm) / 1000) * SHELF_SUPPORT_PRICE_PER_METER[finish]).toFixed(2))
);

const clampInteger = (value: number, min: number, max: number) => (
  Math.min(max, Math.max(min, Math.round(Number(value) || min)))
);

const createIdFactory = (prefix: string) => {
  let index = 0;
  return (part: string) => `${prefix}-${part}-${++index}`;
};

const createHoles = (
  id: (part: string) => string,
  positions: number[],
  side: ProfileSide,
  options: Pick<DrillHole, 'type' | 'threadSize' | 'fastenerHead' | 'fastenerLengthMm'> = {
    type: 'countersunk',
  },
): DrillHole[] => positions.map((positionMm) => ({
  id: id('hole'),
  side,
  positionMm,
  type: options.type,
  threadSize: options.threadSize,
  fastenerHead: options.fastenerHead,
  fastenerLengthMm: options.fastenerLengthMm,
  grooveIndex: 0,
  physicalGrooveIndex: 0,
}));

const createProfile = (
  id: (part: string) => string,
  options: {
    variantId: '2020' | '2040';
    length: number;
    position: [number, number, number];
    rotation?: [number, number, number];
    holes?: DrillHole[];
    tappingLeft?: boolean;
    tappingRight?: boolean;
    remark: string;
  },
): ParametricSceneItem => ({
  id: id('profile'),
  kind: 'profile',
  name: options.variantId,
  position: options.position,
  rotation: options.rotation || [0, 0, 0],
  colorId: 'natural',
  quantity: 1,
  variantId: options.variantId,
  length: options.length,
  holes: options.holes || [],
  tappingLeft: !!options.tappingLeft,
  tappingRight: !!options.tappingRight,
  remark: options.remark,
});

export const getCalligraphyCabinetDimensions = (columnsInput: number, layersInput: number) => {
  const maxColumns = Math.floor((CALLIGRAPHY_MAX_LENGTH_MM - CALLIGRAPHY_PROFILE_MM) / (
    CALLIGRAPHY_BASKET_WIDTH_MM + CALLIGRAPHY_PROFILE_MM
  ));
  const maxLayers = Math.floor(
    (MAX_FURNITURE_PROFILE_MM
      - CALLIGRAPHY_PROFILE_MM * 2
      - CALLIGRAPHY_LAYER_PITCH_MM / 2) / CALLIGRAPHY_LAYER_PITCH_MM,
  );
  const columns = clampInteger(columnsInput, 1, maxColumns);
  const layers = clampInteger(layersInput, 1, maxLayers);
  return {
    columns,
    layers,
    lengthMm: columns * CALLIGRAPHY_BASKET_WIDTH_MM + (columns + 1) * CALLIGRAPHY_PROFILE_MM,
    heightMm: layers * CALLIGRAPHY_LAYER_PITCH_MM
      + CALLIGRAPHY_LAYER_PITCH_MM / 2
      + CALLIGRAPHY_PROFILE_MM * 2,
    depthMm: CALLIGRAPHY_OUTER_DEPTH_MM,
  };
};

export const getCalligraphyGridForBounds = (lengthInput: number, heightInput: number) => {
  const requestedLengthMm = clampInteger(lengthInput, 340, CALLIGRAPHY_MAX_LENGTH_MM);
  const requestedHeightMm = clampInteger(heightInput, 235, MAX_FURNITURE_PROFILE_MM);
  const columns = Math.max(1, Math.floor(
    (requestedLengthMm - CALLIGRAPHY_PROFILE_MM) /
    (CALLIGRAPHY_BASKET_WIDTH_MM + CALLIGRAPHY_PROFILE_MM),
  ));
  const layers = Math.max(1, Math.floor(
    (requestedHeightMm
      - CALLIGRAPHY_PROFILE_MM * 2
      - CALLIGRAPHY_LAYER_PITCH_MM / 2) / CALLIGRAPHY_LAYER_PITCH_MM,
  ));
  return {
    ...getCalligraphyCabinetDimensions(columns, layers),
    requestedLengthMm,
    requestedHeightMm,
  };
};

export const buildCalligraphyCabinetTemplate = (
  columnsInput: number,
  layersInput: number,
): ParametricTemplatePayload => {
  const dimensions = getCalligraphyCabinetDimensions(columnsInput, layersInput);
  const { columns, layers, lengthMm, heightMm, depthMm } = dimensions;
  const id = createIdFactory(`calligraphy-${columns}x${layers}`);
  const items: ParametricSceneItem[] = [];
  const halfLength = lengthMm / 2;
  const halfDepth = depthMm / 2;
  const frontZ = halfDepth - CALLIGRAPHY_PROFILE_MM / 2;
  const backZ = -frontZ;
  const bottomY = CALLIGRAPHY_PROFILE_MM / 2;
  const topY = heightMm - CALLIGRAPHY_PROFILE_MM / 2;
  const verticalLength = heightMm - CALLIGRAPHY_PROFILE_MM * 2;
  const verticalHolePositions = Array.from(
    { length: layers },
    (_, layer) => (layer + 1) * CALLIGRAPHY_LAYER_PITCH_MM,
  );
  const boundaryXs = Array.from(
    { length: columns + 1 },
    (_, boundary) => -halfLength + CALLIGRAPHY_PROFILE_MM / 2
      + boundary * (CALLIGRAPHY_BASKET_WIDTH_MM + CALLIGRAPHY_PROFILE_MM),
  );
  const boundaryHolePositions = boundaryXs.map((x) => x + halfLength);

  // Continuous top and bottom rails span every column at the front and back.
  [frontZ, backZ].forEach((z, faceIndex) => {
    const side: ProfileSide = faceIndex === 0 ? 'B' : 'D';
    items.push(createProfile(id, {
      variantId: '2020',
      length: lengthMm,
      position: [0, bottomY, z],
      holes: [
        ...createHoles(id, boundaryHolePositions, side),
        ...createHoles(id, boundaryHolePositions, 'C', { type: 'through' }),
      ],
      tappingLeft: true,
      tappingRight: true,
      remark: `舒法特柜底部贯通横梁（${faceIndex === 0 ? '前' : '后'}），连接深度梁孔位`,
    }));
    items.push(createProfile(id, {
      variantId: '2020',
      length: lengthMm,
      position: [0, topY, z],
      holes: [
        ...createHoles(id, boundaryHolePositions, side),
        ...createHoles(id, boundaryHolePositions, 'A', { type: 'through' }),
      ],
      tappingLeft: true,
      tappingRight: true,
      remark: `舒法特柜顶部贯通横梁（${faceIndex === 0 ? '前' : '后'}），连接顶部框架深度梁并通孔连接立柱`,
    }));
  });

  boundaryXs.forEach((x, boundary) => {
    [frontZ, backZ].forEach((z, faceIndex) => {
      const side: ProfileSide = faceIndex === 0 ? 'B' : 'D';
      items.push(createProfile(id, {
        variantId: '2020',
        length: verticalLength,
        position: [x, heightMm / 2, z],
        rotation: [0, 0, 90],
        holes: createHoles(id, verticalHolePositions, side),
        tappingLeft: true,
        tappingRight: true,
        remark: `舒法特柜第${boundary + 1}道立柱（${faceIndex === 0 ? '前' : '后'}），沉头孔中心距130mm`,
      }));
    });
  });

  // Bottom and top depth rails are frame-only members on the same planes as
  // the continuous rails. They never receive shelf-support accessories.
  [bottomY, topY].forEach((y, levelIndex) => {
    boundaryXs.forEach((x, boundary) => {
      items.push(createProfile(id, {
        variantId: '2020',
        length: CALLIGRAPHY_BASKET_DEPTH_MM,
        position: [x, y, 0],
        rotation: [0, 90, 0],
        tappingLeft: true,
        tappingRight: true,
        remark: `舒法特柜${levelIndex === 0 ? '底部' : '顶部'}第${boundary + 1}道420mm框架深度梁（不装层板托），两端攻丝`,
      }));
    });
  });

  // Each divider line gets one centered 420 mm rail per layer. Interior rails
  // support baskets on both sides; outer rails only receive the inward support.
  for (let layer = 0; layer < layers; layer += 1) {
    const y = CALLIGRAPHY_PROFILE_MM + (layer + 1) * CALLIGRAPHY_LAYER_PITCH_MM;
    boundaryXs.forEach((x, boundary) => {
      items.push(createProfile(id, {
        variantId: '2020',
        length: CALLIGRAPHY_BASKET_DEPTH_MM,
        position: [x, y, 0],
        rotation: [0, 90, 0],
        tappingLeft: true,
        tappingRight: true,
        remark: `中间第${layer + 1}层第${boundary + 1}道420mm共享承托型材，与立柱孔位对齐并安装层板托，两端攻丝`,
      }));
      const supportSides = [
        ...(boundary > 0 ? [-1] : []),
        ...(boundary < columns ? [1] : []),
      ];
      supportSides.forEach((supportSide) => {
        items.push({
          id: id('support'),
          kind: 'shelf_support',
          name: 'Shelf support',
          position: [x + supportSide * 14, y + 6, 0],
          rotation: [0, 0, 0],
          colorId: 'natural',
          quantity: 1,
          width: 12,
          height: 2,
          thickness: 400,
          finish: 'oxidized',
          accessoryPrice: getShelfSupportUnitPrice(400, 'oxidized'),
          accessoryProfileSize: '2020',
          remark: `第${layer + 1}层第${boundary + 1}道深度梁${supportSide < 0 ? '左' : '右'}侧层板托`,
        });
      });
    });
  }

  items.push({
    id: id('top-board'),
    kind: 'marine_board',
    name: '12mm marine-board top',
    position: [0, heightMm + 6, 0],
    rotation: [90, 0, 0],
    colorId: 'wood_natural',
    quantity: 1,
    width: lengthMm,
    height: depthMm,
    thickness: 12,
    remark: '12mm海洋板整片顶板，覆盖全部型材',
  });

  return {
    schemaVersion: 1,
    source: 'calligraphy_cabinet',
    createdAt: new Date().toISOString(),
    summary: {
      columns,
      layers,
      lengthMm,
      heightMm,
      depthMm,
      basketWidthMm: CALLIGRAPHY_BASKET_WIDTH_MM,
      basketDepthMm: CALLIGRAPHY_BASKET_DEPTH_MM,
      basketHeightMm: CALLIGRAPHY_BASKET_HEIGHT_MM,
      holePitchMm: CALLIGRAPHY_LAYER_PITCH_MM,
    },
    items,
  };
};

export const buildWardrobeTemplate = (
  lengthInput: number,
  widthInput: number,
  heightInput: number,
): ParametricTemplatePayload => {
  const lengthMm = clampInteger(lengthInput, 400, MAX_FURNITURE_PROFILE_MM);
  const widthMm = clampInteger(widthInput, 300, MAX_FURNITURE_PROFILE_MM);
  const heightMm = clampInteger(heightInput, 500, MAX_FURNITURE_PROFILE_MM);
  const id = createIdFactory('wardrobe');
  const items: ParametricSceneItem[] = [];
  const halfLength = lengthMm / 2;
  const halfWidth = widthMm / 2;
  const bottomY = 10;
  const topY = heightMm - 10;
  const frontPostZ = halfWidth - 20;
  const backPostZ = -frontPostZ;
  const frontRailZ = halfWidth - 10;
  const backRailZ = -frontRailZ;
  const leftX = -halfLength + 10;
  const rightX = halfLength - 10;
  const verticalLength = heightMm - 40;
  const depthRailLength = widthMm - 40;

  // At each level the full-length front/rear rail occupies the outer 20 mm
  // half of the 2040 end face, while the depth rail occupies the inner half.
  // Both therefore press onto separate tapping ports of the vertical 2040.
  [bottomY, topY].forEach((y, levelIndex) => {
    const verticalEntrySide: ProfileSide = levelIndex === 0 ? 'C' : 'A';
    [frontRailZ, backRailZ].forEach((z, faceIndex) => items.push(createProfile(id, {
      variantId: '2020',
      length: lengthMm,
      position: [0, y, z],
      holes: [
        ...createHoles(id, [10, lengthMm - 10], verticalEntrySide),
        ...createHoles(
          id,
          [10, lengthMm - 10],
          faceIndex === 0 ? 'D' : 'B',
          { type: 'through', threadSize: 'M6', fastenerHead: 'flat_socket', fastenerLengthMm: 8 },
        ),
      ],
      tappingLeft: true,
      tappingRight: true,
      remark: `衣柜${levelIndex === 0 ? '底部' : '顶部'}${faceIndex === 0 ? '前' : '后'}横梁2020；沉头螺丝连接2040，通孔扁头M6×8拧入侧向2020端部攻丝，两端攻丝`,
    })));
    [leftX, rightX].forEach((x, sideIndex) => items.push(createProfile(id, {
      variantId: '2020',
      length: depthRailLength,
      position: [x, y, 0],
      rotation: [0, 90, 0],
      holes: createHoles(id, [10, depthRailLength - 10], verticalEntrySide),
      tappingLeft: true,
      tappingRight: true,
      remark: `衣柜${levelIndex === 0 ? '底部' : '顶部'}${sideIndex === 0 ? '左' : '右'}侧横梁2020；横压2040并以沉头螺丝连接，端部攻丝接收相邻2020的扁头M6×8，两端攻丝`,
    })));
  });

  // [0, 90, 90] turns the 2040 so its 20 mm face is outward in the front
  // view and its 40 mm face runs along the cabinet side/depth direction.
  [leftX, rightX].forEach((x, xIndex) => [frontPostZ, backPostZ].forEach((z, zIndex) => {
    items.push(createProfile(id, {
      variantId: '2040',
      length: verticalLength,
      position: [x, heightMm / 2, z],
      rotation: [0, 90, 90],
      tappingLeft: true,
      tappingRight: true,
      remark: `衣柜${xIndex === 0 ? '左' : '右'}${zIndex === 0 ? '前' : '后'}立柱2040；20面朝外、40面朝侧面，横梁压住上下端，两端攻丝`,
    }));
  }));

  return {
    schemaVersion: 1,
    source: 'wardrobe',
    createdAt: new Date().toISOString(),
    summary: {
      lengthMm,
      widthMm,
      heightMm,
      profileCount: items.length,
      horizontalProfile: '2020',
      verticalProfile: '2040',
    },
    items,
  };
};
