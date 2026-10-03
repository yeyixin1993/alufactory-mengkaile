import {
  ACCESSORY_COLOR_MODES,
  ACCESSORY_DEFINITIONS,
  ACCESSORY_ROWS,
  ACCESSORY_SERIES_ORDER,
  ACCESSORY_UNIVERSAL_SERIES,
  DEFAULT_ACCESSORY_COLOR_MODE,
  buildAccessoryRowKey,
  getAccessoryRowSeriesLabel,
  getAccessorySelectionSeriesLabel,
  getAccessorySeriesOf,
  migrateLegacyAccessoryQuantities,
} from '../data/accessoryCatalog';
import {
  buildAccessoryQuoteLines,
  isAccessoryColorMode,
  normalizeAccessoryColorMode,
  resolveAccessoryUnitPrice,
  setAccessoryQuantity,
  summarizeAccessoryQuote,
} from '../utils/accessoryQuote';
import { ACCESSORY_BULK_THRESHOLD } from '../utils/accessoryPricing';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

// 1. The list must contain EVERY accessory, never a size-filtered subset.
const rowsByDefId = new Map<string, string[]>();
ACCESSORY_ROWS.forEach((row) => {
  const seriesList = rowsByDefId.get(row.defId) || [];
  seriesList.push(row.series);
  rowsByDefId.set(row.defId, seriesList);
});
assert(
  rowsByDefId.size === ACCESSORY_DEFINITIONS.length,
  `every accessory definition must be listed, got ${rowsByDefId.size} of ${ACCESSORY_DEFINITIONS.length}`,
);
ACCESSORY_DEFINITIONS.forEach((def) => {
  const listed = rowsByDefId.get(def.id);
  assert(listed && listed.length > 0, `accessory ${def.id} is missing from the list`);
  if (def.naturalOnly) {
    assert(
      listed!.length === 1 && listed![0] === ACCESSORY_UNIVERSAL_SERIES,
      `universal accessory ${def.id} must appear exactly once, got ${JSON.stringify(listed)}`,
    );
    return;
  }
  const expected = getAccessorySeriesOf(def);
  assert(expected.length > 0, `accessory ${def.id} has no priced profile series`);
  assert(
    listed!.length === expected.length,
    `accessory ${def.id} must list all ${expected.length} series, got ${listed!.length}`,
  );
  assert(
    expected.every((series) => listed!.includes(series)),
    `accessory ${def.id} is missing a compatible series: ${JSON.stringify(listed)}`,
  );
});

// 2. Series is a description, so the order stays grouped and keys stay unique.
assert(
  new Set(ACCESSORY_ROWS.map((row) => row.key)).size === ACCESSORY_ROWS.length,
  'accessory row keys must be unique',
);
const seenDefOrder: string[] = [];
ACCESSORY_ROWS.forEach((row) => {
  if (seenDefOrder[seenDefOrder.length - 1] !== row.defId) seenDefOrder.push(row.defId);
});
assert(
  new Set(seenDefOrder).size === seenDefOrder.length,
  'rows for the same accessory must stay adjacent',
);
assert(
  ACCESSORY_ROWS.every((row) => row.price && row.name.cn && row.series),
  'every row must carry a price, a name and a series description',
);
assert(
  buildAccessoryRowKey('7L', '2020') === '7L::2020',
  'row keys must encode the profile series',
);
assert(getAccessoryRowSeriesLabel(ACCESSORY_ROWS[0], 'cn').length > 0, 'series label must render');

// 3. Colour choice is binary and defaults to 本色.
assert(
  ACCESSORY_COLOR_MODES.length === 2
  && ACCESSORY_COLOR_MODES[0] === 'natural'
  && ACCESSORY_COLOR_MODES[1] === 'colored',
  'only 本色 / 彩色 may be offered',
);
assert(DEFAULT_ACCESSORY_COLOR_MODE === 'natural', '本色 must stay the default colour');
assert(normalizeAccessoryColorMode(undefined) === 'natural', 'missing colour mode must fall back to 本色');
assert(normalizeAccessoryColorMode('FANCY') === 'natural', 'unknown colour mode must fall back to 本色');
assert(normalizeAccessoryColorMode('colored') === 'colored', 'colored must be preserved');
assert(isAccessoryColorMode('natural') && !isAccessoryColorMode('red'), 'colour-mode guard must be strict');

// 4. Quantities: empty by default, cleared keys are dropped.
assert(summarizeAccessoryQuote({}, 'natural', 'cn').total === 0, 'empty selection must cost nothing');
const qtyRow = ACCESSORY_ROWS.find((row) => !row.naturalOnly && !row.lengthPriced)!;
const cleared = setAccessoryQuantity({ a: 2 }, 'a', 0);
assert(!('a' in cleared), 'a zeroed quantity must be removed from the map');
const bumped = setAccessoryQuantity({}, qtyRow.key, 3.9);
assert(bumped[qtyRow.key] === 3, 'quantities must be floored to whole units');

// 5. Pricing tiers: natural vs colored, plus the bulk threshold.
const tierRow = ACCESSORY_ROWS.find((row) => (
  !row.naturalOnly
  && !row.lengthPriced
  && row.price.colored > row.price.natural
  && row.price.naturalBulk < row.price.natural
))!;
assert(
  resolveAccessoryUnitPrice(tierRow, 'natural', 1) === tierRow.price.natural,
  '本色 must use the natural tier',
);
assert(
  resolveAccessoryUnitPrice(tierRow, 'colored', 1) === tierRow.price.colored,
  '彩色 must use the coloured tier',
);
assert(
  resolveAccessoryUnitPrice(tierRow, 'natural', ACCESSORY_BULK_THRESHOLD) === tierRow.price.naturalBulk,
  'bulk quantity must use the bulk tier',
);
assert(
  resolveAccessoryUnitPrice(tierRow, 'natural', ACCESSORY_BULK_THRESHOLD - 1) === tierRow.price.natural,
  'below the threshold the retail tier must apply',
);
const lengthRow = ACCESSORY_ROWS.find((row) => row.lengthPriced)!;
assert(
  resolveAccessoryUnitPrice(lengthRow, 'natural', 1, 500) === Math.round(lengthRow.price.natural * 0.5 * 100) / 100,
  'length-priced parts must scale with the entered length',
);

// 6. Totals and the "适配型号" description summary.
const pricedRows = ACCESSORY_ROWS.filter((row) => !row.naturalOnly).slice(0, 2);
const totals = summarizeAccessoryQuote(
  { [pricedRows[0].key]: 2, [pricedRows[1].key]: 1 },
  'natural',
  'cn',
);
assert(totals.totalQuantity === 3, 'total quantity must sum every row');
assert(totals.lines.length === 2, 'only rows with a quantity must produce lines');
assert(
  Math.abs(totals.total - (pricedRows[0].price.natural * 2 + pricedRows[1].price.natural)) < 0.05,
  `total must equal the sum of row subtotals, got ${totals.total}`,
);
assert(
  totals.seriesLabel.includes(pricedRows[0].series) || pricedRows[0].series === pricedRows[1].series,
  'series description must list the selected profile series',
);
assert(
  getAccessorySelectionSeriesLabel([], 'cn') === '-',
  'an empty selection must describe no series',
);
assert(
  getAccessorySelectionSeriesLabel(pricedRows, 'cn') ===
    Array.from(new Set(pricedRows.map((row) => row.series))).join(' / '),
  'series description must de-duplicate',
);
assert(
  buildAccessoryQuoteLines({}, 'natural').length === 0,
  'no lines may be produced without quantities',
);

// 7. Legacy cart migration: old per-cart single profile size still edits fine.
const legacyTarget = ACCESSORY_ROWS.find((row) => !row.naturalOnly && row.series === '2020')!;
const migrated = migrateLegacyAccessoryQuantities(
  { [legacyTarget.defId]: 4 },
  '2020',
);
assert(
  migrated[buildAccessoryRowKey(legacyTarget.defId, '2020')] === 4,
  'legacy quantities must move onto the matching series row',
);
assert(
  Object.keys(migrateLegacyAccessoryQuantities({ [legacyTarget.defId]: 0 }, '2020')).length === 0,
  'legacy zero quantities must be dropped',
);
const universalRow = ACCESSORY_ROWS.find((row) => row.naturalOnly)!;
assert(
  migrateLegacyAccessoryQuantities({ [universalRow.defId]: 1 }, '2020')[
    buildAccessoryRowKey(universalRow.defId, ACCESSORY_UNIVERSAL_SERIES)
  ] === 1,
  'universal parts must migrate onto the universal row',
);
assert(
  Object.keys(migrateLegacyAccessoryQuantities({ unknown_sku: 5 }, '2020')).length === 0,
  'unknown legacy ids must be ignored',
);

// 8. Series order used by the list stays the canonical 1515 → 4040 order.
assert(
  ACCESSORY_SERIES_ORDER.join(',') === '1515,2020,3030,4040',
  'profile series order must stay stable',
);

console.log(`OK: ${ACCESSORY_ROWS.length} accessory rows across ${ACCESSORY_DEFINITIONS.length} accessories`);
console.log(`   colour modes: ${ACCESSORY_COLOR_MODES.join(' / ')} (default ${DEFAULT_ACCESSORY_COLOR_MODE})`);
console.log(`   bulk threshold: ${ACCESSORY_BULK_THRESHOLD}`);

// No.3 is purchasable and temporarily follows all No.7 price tiers.
const no3 = ACCESSORY_DEFINITIONS.find((def) => def.id === '3');
const no7 = ACCESSORY_DEFINITIONS.find((def) => def.id === '7L')!;
assert(no3 && JSON.stringify(no3.prices) === JSON.stringify(no7.prices), 'No.3 must share No.7 pricing');
const shaftQuote = summarizeAccessoryQuote({ [lengthRow.key]: 2 }, 'natural', 'cn', 1000);
assert(shaftQuote.total === lengthRow.price.natural * 2, 'quick quote must include two metres of shaft in the total');
