import assert from 'node:assert/strict';
import { ProductType, type CartItem } from '../types';
import { ensureCartEntryIds, finishCartHydration, prepareCartAdditions, preserveCartEntryMetadata, reconcileCartItems, restoreCartSnapshot } from '../utils/cartState';

const row = (id: string, quantity = 2): CartItem => ({
  id, product: { id: 'p2', type: ProductType.PROFILE, name: { cn: '型材', en: 'Profile', jp: '型材' }, description: { cn: '', en: '', jp: '' }, basePrice: 1, imageUrl: '' },
  quantity, totalPrice: quantity * 10, config: { variantId: '2020', length: 500, colorId: 'natural' },
});
const old = row('legacy');
const remoteOld = { ...old, id: 'database-17' };
assert.equal(reconcileCartItems([old], [remoteOld])[0].quantity, 2, 'Identical cached snapshots must never add quantities');
assert.equal(reconcileCartItems([old], [remoteOld]).length, 1);
assert.equal(reconcileCartItems([old, row('legacy-2')], [remoteOld, row('database-18')]).length, 2, 'Legacy equal rows reconcile one-to-one');

const first = prepareCartAdditions([old], '2026-11-14T01:00:00Z')[0];
const second = prepareCartAdditions([old], '2026-11-14T02:00:00Z')[0];
assert.notEqual(first.id, second.id, 'Separate explicit additions remain independently removable');
assert.equal(reconcileCartItems([first], [remoteOld]).length, 2, 'A new dated addition cannot disappear into an old equivalent row');
assert.equal(reconcileCartItems([first, second], [first, second]).length, 2);
assert.equal(first.config.cartAddedAt, '2026-11-14T01:00:00Z');
assert.equal(ensureCartEntryIds([old])[0].config.cartAddedAt, undefined, 'Do not invent legacy addition dates');
const edited = preserveCartEntryMetadata(first, { ...first, config: { length: 700 }, quantity: 3 });
assert.equal(edited.config.cartAddedAt, first.config.cartAddedAt);
assert.equal(edited.config.cartEntryId, first.config.cartEntryId);

let cached = [first, second];
let server = structuredClone(cached);
for (let refresh = 0; refresh < 20; refresh++) {
  const restored = restoreCartSnapshot(cached, [], server, false);
  cached = finishCartHydration(cached, cached, restored);
  server = structuredClone(cached); // PUT replaces the snapshot, never adds it.
}
assert.equal(cached.length, 2);
assert.equal(cached.reduce((sum, item) => sum + item.quantity, 0), 4, 'Repeated refreshes must not inflate quantity');
assert.deepEqual(restoreCartSnapshot([first], [], [], false), [], 'A clean stale cache cannot resurrect a server-deleted row');
assert.deepEqual(restoreCartSnapshot([], [], [first], true), [], 'An unsynced clear remains empty across refresh');
assert.deepEqual(restoreCartSnapshot([edited], [], [first], true), [edited], 'Pending local edits survive a failed PUT and reload');
assert.equal(restoreCartSnapshot([first], [first], [first], false).length, 1, 'Login migration must not add the same snapshot twice');
assert.equal(restoreCartSnapshot([first], [second], [first], false).length, 2, 'A genuine guest addition remains separate');

const baseline = [first, second];
const third = prepareCartAdditions([row('third')])[0];
const hydrated = finishCartHydration(baseline, [edited, third], [first, second]);
assert.deepEqual(hydrated.map(item => item.id).sort(), [first.id, third.id].sort(), 'Slow GET must preserve edit, delete and addition');
assert.equal(hydrated.find(item => item.id === first.id)?.config.length, 700);
assert.equal(finishCartHydration(baseline, [], baseline).length, 0, 'Clear during GET must remain empty');
const legacyHydrated = finishCartHydration([old, row('legacy-2')], [row('legacy-2')], [remoteOld, row('database-18')]);
assert.equal(legacyHydrated.length, 1, 'Deleting one identical legacy row must not delete both');
assert.equal(legacyHydrated[0].quantity, 2);
assert.equal(first.config.length, 500, 'Operations must not mutate input snapshots');
console.log('Cart state regression passed: 20 refreshes, legacy and login migration, separate additions/timestamps, pending edits/deletion, slow GET, stable identity.');
