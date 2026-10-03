import {
  buildCalligraphyCabinetTemplate,
  CALLIGRAPHY_BASKET_DEPTH_MM,
  CALLIGRAPHY_BASKET_WIDTH_MM,
  CALLIGRAPHY_LAYER_PITCH_MM,
  CALLIGRAPHY_PROFILE_MM,
  getCalligraphyCabinetDimensions,
  getCalligraphyColumnLimit,
  getCalligraphyGridForBounds,
  getCalligraphyInnerDepthMm,
  isCalligraphyLongOpening,
} from '../utils/parametricFurniture';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const expectedHeight = (layers: number) => (
  layers * CALLIGRAPHY_LAYER_PITCH_MM + CALLIGRAPHY_LAYER_PITCH_MM / 2 + CALLIGRAPHY_PROFILE_MM * 2
);

// 1. Default (short-side 300mm opening) keeps the historical geometry exactly.
const shortDims = getCalligraphyCabinetDimensions(3, 5);
assert(shortDims.openingSide === 'short', 'default opening side must remain the 300mm short side');
assert(shortDims.openingWidthMm === CALLIGRAPHY_BASKET_WIDTH_MM, 'short opening width must be 300mm');
assert(shortDims.lengthMm === 3 * 300 + 4 * 20, 'short opening length regressed');
assert(shortDims.depthMm === 460, 'short opening outside depth must stay 460mm');
assert(shortDims.heightMm === expectedHeight(5), 'short opening height regressed');

// 2. Long-side 420mm opening widens every bay and shallows the cabinet.
const longDims = getCalligraphyCabinetDimensions(3, 5, 'long');
assert(longDims.openingSide === 'long', 'long opening side was not preserved');
assert(longDims.openingWidthMm === CALLIGRAPHY_BASKET_DEPTH_MM, 'long opening width must be 420mm');
assert(longDims.lengthMm === 3 * 420 + 4 * 20, 'long opening length regressed');
assert(longDims.depthMm === 340, 'long opening outside depth must be 300 + 2x20 = 340mm');
assert(longDims.heightMm === expectedHeight(5), 'opening side must not change cabinet height');
assert(getCalligraphyInnerDepthMm('long') === CALLIGRAPHY_BASKET_WIDTH_MM, 'long opening depth rail must be 300mm');
assert(getCalligraphyInnerDepthMm('short') === CALLIGRAPHY_BASKET_DEPTH_MM, 'short opening depth rail must be 420mm');

// 3. Column limits and bound mode follow the selected bay width.
assert(getCalligraphyColumnLimit('short') === 9, 'short opening must still allow nine bays');
assert(getCalligraphyColumnLimit('long') === 6, 'long opening must allow six bays inside 3000mm');
assert(getCalligraphyCabinetDimensions(99, 5, 'long').columns === 6, 'long opening columns were not clamped');
assert(getCalligraphyGridForBounds(980, 755, 'short').columns === 3, 'short bound-mode columns regressed');
assert(getCalligraphyGridForBounds(1340, 755, 'long').columns === 3, 'long bound-mode columns regressed');
assert(getCalligraphyGridForBounds(980, 755, 'long').columns === 2, 'same 980mm limit must hold fewer long bays');
assert(getCalligraphyGridForBounds(10, 755, 'long').requestedLengthMm === 460, 'long bound mode must clamp to one bay');

// 4. Generated geometry: depth rails, supports, boards and summary.
(['short', 'long'] as const).forEach((openingSide) => {
  const columns = 3;
  const layers = 5;
  const payload = buildCalligraphyCabinetTemplate(columns, layers, openingSide);
  const railLength = getCalligraphyInnerDepthMm(openingSide);
  const depthRails = payload.items.filter(
    (item) => item.kind === 'profile' && item.rotation[1] === 90 && item.length === railLength,
  );
  assert(
    depthRails.length === (layers + 2) * (columns + 1),
    `${openingSide} opening must generate (layers+2)x(columns+1) depth rails`,
  );
  assert(
    payload.items.every((item) => !(item.kind === 'profile' && item.rotation[1] === 90) || item.length === railLength),
    `${openingSide} opening produced a depth rail of the wrong length`,
  );

  const supports = payload.items.filter((item) => item.kind === 'shelf_support');
  assert(supports.length === layers * columns * 2, `${openingSide} opening support count regressed`);
  assert(
    supports.every((item) => item.thickness === railLength - CALLIGRAPHY_PROFILE_MM),
    `${openingSide} opening support length must follow the depth rail`,
  );
  const expectedUnitPrice = Number((((railLength - CALLIGRAPHY_PROFILE_MM) / 1000) * 8).toFixed(2));
  assert(
    supports.every((item) => item.accessoryPrice === expectedUnitPrice),
    `${openingSide} opening support price must be priced by real length`,
  );

  const boards = payload.items.filter((item) => item.kind === 'marine_board');
  assert(boards.length === 1, `${openingSide} opening must keep one marine-board top`);
  assert(
    boards.every((item) => item.height === payload.summary.depthMm),
    `${openingSide} opening top board must cover the outside depth`,
  );

  const uprights = payload.items.filter((item) => item.kind === 'profile' && item.rotation[2] === 90);
  assert(uprights.length === (columns + 1) * 2, `${openingSide} opening upright count regressed`);
  const firstUprightX = Math.min(...uprights.map((item) => item.position[0]));
  const lastUprightX = Math.max(...uprights.map((item) => item.position[0]));
  const bayPitch = payload.summary.openingWidthMm as number + CALLIGRAPHY_PROFILE_MM;
  assert(
    Math.abs((lastUprightX - firstUprightX) - columns * bayPitch) < 1e-6,
    `${openingSide} opening upright pitch must equal the bay pitch`,
  );
  assert(
    Math.abs(Math.abs(firstUprightX) - (Number(payload.summary.lengthMm) / 2 - CALLIGRAPHY_PROFILE_MM / 2)) < 1e-6,
    `${openingSide} opening uprights must stay inside the generated length`,
  );

  assert(payload.summary.openingSide === openingSide, `${openingSide} summary lost its opening side`);
  assert(payload.summary.depthMm === (openingSide === 'long' ? 340 : 460), `${openingSide} summary depth is wrong`);
  assert(payload.summary.lengthMm === longDims.lengthMm || openingSide === 'short', 'summary length is wrong');
  assert(
    isCalligraphyLongOpening(payload.summary.openingSide, payload.summary.openingWidthMm) === (openingSide === 'long'),
    `${openingSide} opening detection disagrees with the summary`,
  );
  assert(
    depthRails.every((item) => String(item.remark || '').includes(`${railLength}mm`)),
    `${openingSide} opening depth-rail remarks must state the real ${railLength}mm rail length`,
  );
});

// 5. Legacy two-argument calls remain byte-identical to the old short-side output.
const legacy = buildCalligraphyCabinetTemplate(3, 5);
assert(legacy.summary.depthMm === 460, 'legacy call must keep the 460mm depth');
assert(legacy.summary.lengthMm === 980, 'legacy call must keep the 980mm length');
assert(
  legacy.items.some((item) => item.kind === 'shelf_support' && item.thickness === 400),
  'legacy call must keep 400mm shelf supports',
);

console.log('Calligraphy-cabinet opening-side regression checks passed.');
