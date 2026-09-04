import fs from 'node:fs';
import path from 'node:path';

const PROFILE_VARIANTS = new Set([
  '1515', '1515-N1', '1515-N2',
  '2020', '2020-N1', '2020-N2', '2020-N2-OPP', '2020-N3', '2020-N4-SQ', '2020-N4-RD', '2020R',
  '2040', '2040-N1-20', '2040-N1-40', '2047', '2060', '20100',
  '3030', '3030-N1', '3030-N2', '3030R', '3060', '3060-N1-60',
  '4040', '4080',
]);

const COLORS = new Set([
  'natural', 'silver', 'red', 'cola_red', 'sapphire_blue', 'purple', 'sky_blue', 'green',
  'willow_green', 'qingli_coffee', 'beige', 'indigo_blue', 'cool_green', 'ink_green',
  'apple_gold', 'olive_brown', 'lime_gold', 'pink', 'coffee', 'black', 'british_grey',
]);

const SIDES = new Set(['A', 'B', 'C', 'D']);
const HOLE_TYPES = new Set(['through', 'countersunk', 'threaded']);
const THREAD_SIZES = new Set(['M3', 'M4', 'M5', 'M6', 'M8']);

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Usage: npm run validate:diy-json -- /absolute/path/to/design.json');
  process.exit(2);
}

const absolutePath = path.resolve(sourcePath);
let document;
try {
  document = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
} catch (error) {
  console.error(`Unable to read JSON: ${error.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];
const finiteVec3 = (value) => Array.isArray(value)
  && value.length === 3
  && value.every((entry) => Number.isFinite(entry));

if (document?.format !== 'mengkaile-diy') errors.push('format must be "mengkaile-diy".');
if (document?.schemaVersion !== 2) errors.push('schemaVersion must be 2.');
if (document?.coordinateUnit !== 'mm') errors.push('coordinateUnit must be "mm".');
if (!Array.isArray(document?.items) || !document.items.length) errors.push('items must be a non-empty array.');

const ids = new Set();
const profileIds = new Set();
(Array.isArray(document?.items) ? document.items : []).forEach((item, itemIndex) => {
  const label = `items[${itemIndex}]`;
  if (!item || typeof item !== 'object') {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (typeof item.id !== 'string' || !item.id.trim()) errors.push(`${label}.id is required.`);
  else if (ids.has(item.id)) errors.push(`${label}.id duplicates "${item.id}".`);
  else ids.add(item.id);
  if (!finiteVec3(item.position)) errors.push(`${label}.position must contain three finite numbers.`);
  if (!finiteVec3(item.rotation)) errors.push(`${label}.rotation must contain three finite numbers.`);
  if (!Number.isInteger(item.quantity) || item.quantity < 1) errors.push(`${label}.quantity must be a positive integer.`);
  if (item.kind === 'marine_board'
      && (!Number.isInteger(item.width) || !Number.isInteger(item.height))) {
    errors.push(`${label}.width and .height must be whole millimetres for marine board.`);
  }

  if (item.kind !== 'profile') return;
  profileIds.add(item.id);
  if (!PROFILE_VARIANTS.has(item.variantId)) errors.push(`${label}.variantId "${item.variantId}" is unsupported.`);
  if (item.name !== item.variantId) warnings.push(`${label}.name differs from variantId; the SKU remains variantId.`);
  if (!Number.isFinite(item.length) || item.length < 21 || item.length > 3000) {
    errors.push(`${label}.length must be within 21–3000mm.`);
  }
  if (item.quantity !== 1) errors.push(`${label} is a placed profile and must use quantity=1.`);
  if (!COLORS.has(item.colorId)) errors.push(`${label}.colorId "${item.colorId}" is unsupported.`);
  if (!Array.isArray(item.holes)) errors.push(`${label}.holes must be an array.`);
  else item.holes.forEach((hole, holeIndex) => {
    const holeLabel = `${label}.holes[${holeIndex}]`;
    if (!hole || typeof hole !== 'object') {
      errors.push(`${holeLabel} must be an object.`);
      return;
    }
    if (!SIDES.has(hole.side)) errors.push(`${holeLabel}.side must be A/B/C/D.`);
    if (!HOLE_TYPES.has(hole.type)) errors.push(`${holeLabel}.type is unsupported.`);
    if (!Number.isFinite(hole.positionMm) || hole.positionMm < 5 || hole.positionMm > item.length - 5) {
      errors.push(`${holeLabel}.positionMm is outside the profile.`);
    } else if (!Number.isInteger(hole.positionMm)) {
      errors.push(`${holeLabel}.positionMm must be a whole millimetre.`);
    }
    if (!Number.isInteger(hole.physicalGrooveIndex) || hole.physicalGrooveIndex < 0) {
      errors.push(`${holeLabel}.physicalGrooveIndex must be a non-negative integer.`);
    }
    if (hole.threadSize != null && !THREAD_SIZES.has(hole.threadSize)) {
      errors.push(`${holeLabel}.threadSize "${hole.threadSize}" is unsupported.`);
    }
  });
});

(Array.isArray(document?.items) ? document.items : []).forEach((item, itemIndex) => {
  (Array.isArray(item?.attachedProfileIds) ? item.attachedProfileIds : []).forEach((profileId) => {
    if (!profileIds.has(profileId)) errors.push(`items[${itemIndex}] references missing profile "${profileId}".`);
  });
  if (item?.linkedProfileId && !profileIds.has(item.linkedProfileId)) {
    errors.push(`items[${itemIndex}] references missing linkedProfileId "${item.linkedProfileId}".`);
  }
});

if (Array.isArray(document?.warnings) && document.warnings.length) {
  warnings.push(`Source document contains ${document.warnings.length} review warning(s).`);
}

warnings.forEach((warning) => console.warn(`WARN: ${warning}`));
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  console.error(`Validation failed: ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log(`Validation passed: ${document.items.length} item(s), ${profileIds.size} profile(s), ${warnings.length} warning(s).`);
