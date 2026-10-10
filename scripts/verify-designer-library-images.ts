import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CONNECTION_ACCESSORY_IMAGE_KEY,
  getConnectionAccessoryImageSrc,
} from '../utils/designerAccessoryImages';
import { ACCESSORY_CODE_IMAGE_MAP } from '../data/accessoryCatalog';

/**
 * The designer library must show the same part photographs as the accessory
 * section.
 *
 * A customer scanning the fastener list previously saw a generic wrench glyph
 * for every row, so "1号角码" and "2号角码" were indistinguishable. The library
 * now resolves each kind through `ACCESSORY_CODE_IMAGE_MAP` — the exact table
 * the quick-quote accessory rows use. These checks keep that link honest:
 * every kind has a key, every key resolves to a picture that actually ships in
 * `public/`, and no kind quietly falls back to a hand-written path.
 *
 * `assert` is imported directly (never aliased): TypeScript only treats these
 * as assertion calls when the call target carries an explicit type annotation.
 */

const root = path.resolve('.');
const kinds = Object.keys(CONNECTION_ACCESSORY_IMAGE_KEY) as Array<keyof typeof CONNECTION_ACCESSORY_IMAGE_KEY>;

// 1. Every designer connection kind has a catalogue image key, and it is the
// same one the accessory section uses for that part number.
assert.deepEqual(
  kinds.slice().sort(),
  ['connector', 'extruded_connector', 'hidden_connector', 'l_connector', 't_connector', 'tee_connector'],
  'every connection kind must be covered',
);
assert.equal(CONNECTION_ACCESSORY_IMAGE_KEY.connector, '1', 'connector is 1号角码');
assert.equal(CONNECTION_ACCESSORY_IMAGE_KEY.extruded_connector, '2', 'extruded_connector is 2号角码');
assert.equal(CONNECTION_ACCESSORY_IMAGE_KEY.hidden_connector, '5', 'hidden_connector is 5号角码');
assert.equal(CONNECTION_ACCESSORY_IMAGE_KEY.l_connector, '7L', 'l_connector is 7号 L型');
assert.equal(CONNECTION_ACCESSORY_IMAGE_KEY.t_connector, '7T', 't_connector is 7号 T型');
assert.equal(CONNECTION_ACCESSORY_IMAGE_KEY.tee_connector, '9', 'tee_connector is 9号三通');

// 2. Each kind resolves to a real photograph. Keys that point at a missing file
// would render a broken image in the library (the catalogue still lists photos
// such as 8.jpg that do not exist), so the mapping must never include them.
for (const kind of kinds) {
  const src = getConnectionAccessoryImageSrc(kind);
  assert.ok(src, `${kind} must resolve to a catalogue picture`);
  assert.equal(
    src,
    ACCESSORY_CODE_IMAGE_MAP[CONNECTION_ACCESSORY_IMAGE_KEY[kind]],
    `${kind} must reuse the accessory-section picture, not a private copy`,
  );
  const file = path.join(root, 'public', src.replace(/^\//, ''));
  assert.ok(existsSync(file), `${kind} image ${src} must exist under public/`);
}

// 3. Two different parts never share one picture — otherwise the customer still
// cannot tell 1号 from 2号.
const used = kinds.map((kind) => getConnectionAccessoryImageSrc(kind));
assert.equal(new Set(used).size, used.length, 'each connection kind needs its own photograph');

// 4. The library renders the picture (with an icon fallback) and the cart lines
// read the shared table instead of a duplicated literal.
const designerSource = readFileSync(path.join(root, 'components/DIYDesigner.tsx'), 'utf8');
assert.match(
  designerSource,
  /import \{ CONNECTION_ACCESSORY_IMAGE_KEY, getConnectionAccessoryImageSrc \} from '\.\.\/utils\/designerAccessoryImages';/,
  'the designer must import the shared image table',
);
assert.match(
  designerSource,
  /const accessoryImage = getConnectionAccessoryImageSrc\(entry\.kind\);/,
  'the level-1 library row must resolve the catalogue picture',
);
assert.match(
  designerSource,
  /\{accessoryImage \? \(\s*<img/,
  'the library must render an <img> when a picture exists',
);
assert.doesNotMatch(
  designerSource,
  /imageKey: '(1|2|5|7L|7T|9)'/,
  'cart lines must not hard-code accessory image keys',
);
assert.match(
  designerSource,
  /imageKey: CONNECTION_ACCESSORY_IMAGE_KEY\.connector/,
  'cart lines must read the shared image table',
);

console.log(`零件库缩略图 ${kinds.length} 个（复用配件区照片）：`);
for (const kind of kinds) {
  console.log(`  ${kind} → ${getConnectionAccessoryImageSrc(kind)}`);
}
console.log('Designer library image checks passed.');
