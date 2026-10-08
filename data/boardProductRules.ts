/**
 * Price-free board and door constraints already used by the local product flow.
 *
 * These values describe the selectable design envelope only. They are not a
 * manufacturing release: material grade, calibrated hole-pattern dimensions,
 * hinge SKU and installation evidence remain separate catalog evidence.
 */
export const BOARD_PRODUCT_RULES = {
  aluminumPlate: {
    maxWidthMm: 2400,
    maxHeightMm: 1200,
    publicThicknessesMm: [2, 5] as const,
    extendedThicknessesMm: [2, 5] as const,
  },
  pegboard: {
    maxShortSideMm: 1200,
    maxLongSideMm: 2400,
    publicThicknessesMm: [2, 5] as const,
    extendedThicknessesMm: [2, 5] as const,
    holePatternId: 'ikea' as const,
    holePatternNames: {
      cn: '宜家孔（竖向长圆孔）',
      en: 'IKEA holes (vertical slots)',
      jp: 'IKEA穴（縦長穴）',
    },
  },
  marineBoard: {
    maxWidthMm: 2440,
    maxHeightMm: 1220,
    selectableThicknessesMm: [12, 18] as const,
  },
  ultraClearGlass: {
    /** User-requested catalog reference only; not yet a placeable/manufacturable panel. */
    referenceThicknessMm: 10,
    source: 'user_supplied_design_requirement' as const,
    status: 'catalog_reference_only' as const,
  },
  cabinetDoor: {
    minWidthMm: 101,
    minHeightMm: 230,
    maxWidthMm: 1500,
    maxHeightMm: 3000,
    panelThicknessMm: 2,
    frameDepthMm: 18,
    centeredHandleLengthMm: 200,
    hingeEndOffsetMm: 100,
  },
} as const;

export const isPegboardSizeWithinDesignEnvelope = (widthMm: number, heightMm: number) => (
  Number.isFinite(widthMm)
  && Number.isFinite(heightMm)
  && widthMm > 0
  && heightMm > 0
  && Math.min(widthMm, heightMm) <= BOARD_PRODUCT_RULES.pegboard.maxShortSideMm
  && Math.max(widthMm, heightMm) <= BOARD_PRODUCT_RULES.pegboard.maxLongSideMm
);

export const getDoorHingePositions = (heightMm: number): number[] => {
  const { maxHeightMm, hingeEndOffsetMm } = BOARD_PRODUCT_RULES.cabinetDoor;
  const height = Math.max(0, Math.min(maxHeightMm, Number(heightMm) || 0));
  if (height <= 0) return [];
  if (height <= 1500) return [hingeEndOffsetMm, height - hingeEndOffsetMm];
  if (height <= 2000) return [hingeEndOffsetMm, height / 2, height - hingeEndOffsetMm];
  if (height <= 2500) {
    const step = (height - hingeEndOffsetMm * 2) / 3;
    return [
      hingeEndOffsetMm,
      hingeEndOffsetMm + step,
      hingeEndOffsetMm + step * 2,
      height - hingeEndOffsetMm,
    ];
  }
  return [
    hingeEndOffsetMm,
    (height - hingeEndOffsetMm * 2) * 0.25 + hingeEndOffsetMm,
    height / 2,
    (height - hingeEndOffsetMm * 2) * 0.75 + hingeEndOffsetMm,
    height - hingeEndOffsetMm,
  ];
};
