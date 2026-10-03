import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildImportedComponentCartItem,
  calculatePrice,
  completeStoolConnectionSystem,
  normalizeDesignItems,
} from '../components/DIYDesigner';
import { groupDiyAccessoryCartItems, groupFactoryDisplayCartItems } from '../utils/cartAccessories';
import { ProductType, type CartItem, type Product } from '../types';
import { buildStoolTemplateFromAsset, type StoolSourceAsset } from '../utils/parametricStool';

/**
 * Identical source parts must be ONE purchasing line, in the cart and in the
 * factory PDF.
 *
 * The 凳子 places eight identical SHF12A supports and four identical D12 shafts.
 * A source part has no catalogue row to quote back, so it used to be keyed by
 * its scene id — one line per *placement* — and the cart and the PDF showed
 * eight and four separate lines for what the factory buys once.
 *
 * The identity is now built from what the part observably *is* (label, envelope
 * size, price basis, unit price). This regression freezes both directions: the
 * identical placements collapse, and two genuinely different shafts — the
 * oblong stool's 600 mm and 400 mm ones — stay apart. Merging those would be
 * worse than the bug it fixes, because the factory would cut one length.
 */

const asset = JSON.parse(fs.readFileSync('public/models/stool/source-v1.json', 'utf8')) as StoolSourceAsset;

const accessoryProduct: Product = {
  id: 'accessory',
  type: ProductType.ACCESSORY,
  name: { en: 'Aluminum Profile Accessories', cn: '铝型材配件', jp: 'アルミプロファイルアクセサリー' },
  description: { en: '', cn: '', jp: '' },
  basePrice: 0,
  imageUrl: '',
};

type Scene = ReturnType<typeof normalizeDesignItems>;

const stoolAt = (parameters: { widthMm: number; depthMm: number; heightMm: number }): Scene => (
  completeStoolConnectionSystem(normalizeDesignItems(
    buildStoolTemplateFromAsset(parameters, asset).items,
  )).items
);

/** One placed source part paired with the cart line the designer would send. */
const sourceCartEntries = (items: Scene) => items
  .filter((item) => item.kind === 'imported_component')
  .map((item) => ({
    item,
    cart: buildImportedComponentCartItem(item, calculatePrice(item, null), accessoryProduct, 'cn'),
  }));

const withSemanticType = (entries: ReturnType<typeof sourceCartEntries>, semanticType: string) => (
  entries.filter((entry) => entry.item.sourceMesh?.source.semanticType === semanticType)
);

const lineIdOf = (cart: CartItem) => String(((cart.config as any).lines?.[0] || {}).id || '');

/** Every line named `name`, across the whole (already grouped) cart. */
const linesNamed = (cart: CartItem[], name: string) => cart.flatMap((item) => {
  const lines = Array.isArray((item.config as any)?.lines) ? (item.config as any).lines : [];
  return lines
    .filter((line: any) => String(line?.name || '') === name)
    .map((line: any) => ({ line, item }));
});

// --- 1. the square 凳子: identical placements collapse into one line --------
const square = stoolAt({ widthMm: 360, depthMm: 360, heightMm: 500 });
const squareEntries = sourceCartEntries(square);
const supportEntries = withSemanticType(squareEntries, 'shaft_support');
const shaftEntries = withSemanticType(squareEntries, 'shaft');
assert.equal(supportEntries.length, 8, 'the source model places eight SHF12A supports');
assert.equal(shaftEntries.length, 4, 'the source model places four D12 shafts');

// A source part has no catalogue identity, so its line id *is* the part identity.
const supportIds = new Set(supportEntries.map((entry) => lineIdOf(entry.cart)));
assert.equal(supportIds.size, 1, `eight identical supports share one line id, got ${supportIds.size}`);
assert.equal(supportIds.has(''), false, 'a source line must never fall back to an empty id');
const shaftIds = new Set(shaftEntries.map((entry) => lineIdOf(entry.cart)));
assert.equal(shaftIds.size, 1, `four identical shafts share one line id, got ${shaftIds.size}`);
assert.notDeepEqual([...supportIds], [...shaftIds], 'a support and a shaft are different parts');

const squareCart = squareEntries.map((entry) => entry.cart);
const grouped = groupDiyAccessoryCartItems(squareCart);
const supportLines = linesNamed(grouped, 'SHF12A support');
assert.equal(supportLines.length, 1, `eight identical SHF12A supports must be one cart line, got ${supportLines.length}`);
assert.equal(supportLines[0].line.quantity, 8, 'one line carries all eight placements');
const shaftLines = linesNamed(grouped, 'Shaft D12');
assert.equal(shaftLines.length, 1, 'four identical D12 shafts must be one cart line');
assert.equal(shaftLines[0].line.quantity, 4);

// The factory PDF shows the same list, so it must merge the same rows.
const pdf = groupFactoryDisplayCartItems(grouped);
assert.equal(linesNamed(pdf, 'SHF12A support').length, 1, 'the PDF lists the supports once');
assert.equal(linesNamed(pdf, 'Shaft D12').length, 1, 'the PDF lists the shafts once');
assert.equal(linesNamed(pdf, 'SHF12A support')[0].line.quantity, 8, 'and keeps the placement count');

// --- 2. a named catalogue part still keys on its catalogue row -------------
// The No.3 link did not change: sixteen brackets are one order SKU, so they must
// stay one line keyed by the catalogue row rather than by the source identity.
const bracketLines = linesNamed(grouped, '3号角码 · 3030');
assert.equal(bracketLines.length, 1, `sixteen No.3 brackets are one catalogue line, got ${bracketLines.length}`);
assert.equal(bracketLines[0].line.quantity, 16);
assert.equal(bracketLines[0].item.config.importedSourcePart, false, 'a linked part is a catalogue part');
assert.equal(bracketLines[0].item.config.catalogItemId, '3', 'and it quotes back its catalogue definition');
assert.equal(supportLines[0].item.config.importedSourcePart, true, 'an unlinked source part stays a source part');
assert.equal(supportLines[0].item.config.catalogItemId, undefined, 'with no catalogue definition');

// --- 3. two real shaft lengths must NOT merge ------------------------------
const oblong = stoolAt({ widthMm: 600, depthMm: 400, heightMm: 500 });
const oblongShaftEntries = withSemanticType(sourceCartEntries(oblong), 'shaft');
assert.equal(oblongShaftEntries.length, 4);
const oblongIds = new Set(oblongShaftEntries.map((entry) => lineIdOf(entry.cart)));
assert.equal(oblongIds.size, 2, `a 600×400 stool cuts two shaft lengths and must keep two lines, got ${oblongIds.size}`);

// --- 4. the identity is deterministic, not per-instance --------------------
const rebuilt = new Set(sourceCartEntries(stoolAt({ widthMm: 360, depthMm: 360, heightMm: 500 }))
  .filter((entry) => entry.item.sourceMesh?.source.semanticType === 'shaft_support')
  .map((entry) => lineIdOf(entry.cart)));
assert.deepEqual([...rebuilt], [...supportIds], 'rebuilding the same design yields the same line identity');

console.log('Source-part cart merge passed: eight identical SHF12A supports and four identical D12 shafts collapse to one cart/PDF line each (8 and 4), two real shaft lengths stay apart, and the No.3 catalogue link is untouched.');
