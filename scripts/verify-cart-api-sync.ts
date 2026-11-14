import assert from 'node:assert/strict';
import type { CartItem } from '../types';

// Exercise the actual service with controlled network completion order. No
// backend, real account, browser storage or external requests are used.
const store = new Map<string, string>([['authToken', 'account-a']]);
const location = { hostname: 'localhost', origin: 'http://localhost:3000', href: '/#/cart' };
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  },
  window: { location },
});

type Call = { method: string; url: string; auth: string | null; body: any; finish: (status: number, body: unknown) => void };
const calls: Call[] = [];
globalThis.fetch = ((url: string | URL | Request, options: RequestInit = {}) => new Promise<Response>((resolve) => {
  calls.push({
    method: options.method || 'GET', url: String(url),
    auth: new Headers(options.headers).get('Authorization'),
    body: options.body ? JSON.parse(String(options.body)) : null,
    finish: (status, body) => resolve(new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    })),
  });
})) as typeof fetch;

const { ApiService } = await import('../services/apiService');
const flush = async () => { for (let index = 0; index < 30; index++) await Promise.resolve(); };
const waitForCall = async (index: number) => {
  await flush();
  assert(calls[index], `Expected request ${index + 1}; got ${calls.length}`);
  return calls[index];
};
const row = (quantity: number): CartItem => ({
  id: 'stable-cart-entry',
  product: { id: 'p2', type: 'PROFILE' as CartItem['product']['type'], name: { cn: '型材', en: 'Profile', jp: '型材' }, description: { cn: '', en: '', jp: '' }, imageUrl: '', basePrice: 10 },
  quantity, totalPrice: quantity * 10,
  config: { length: 1000, unitPrice: 10, cartEntryId: 'stable-cart-entry', cartAddedAt: '2026-11-14T01:00:00.000Z' },
});
const replyToPut = (call: Call) => call.finish(200, {
  cart: { items: call.body.items.map((item: any) => ({ ...item, id: 'regenerated-database-id', total_price: item.quantity * item.unit_price })) },
});

const first = ApiService.syncCart([row(2)]);
const laterRow = row(5);
const second = ApiService.syncCart([laterRow]);
laterRow.quantity = 99;
laterRow.config.length = 9999;
const readAfterWrites = ApiService.getCart();
const firstCall = await waitForCall(0);
assert.equal(calls.length, 1, 'Only the first PUT may be in flight');
assert.equal(firstCall.method, 'PUT');
replyToPut(firstCall);
assert.equal((await first).items[0].id, 'stable-cart-entry', 'Database row-ID replacement must not change cart entry identity');
const secondCall = await waitForCall(1);
assert.equal(calls.length, 2, 'GET must still wait for the second PUT');
assert.equal(secondCall.body.items[0].quantity, 5);
assert.equal(secondCall.body.items[0].config.length, 1000, 'Queued config is frozen at call time');
replyToPut(secondCall);
assert.equal((await second).items[0].config.cartAddedAt, '2026-11-14T01:00:00.000Z');
const getCall = await waitForCall(2);
assert.equal(getCall.method, 'GET');
getCall.finish(200, { items: secondCall.body.items });
assert.equal((await readAfterWrites).items[0].quantity, 5);

const failingRead = assert.rejects(ApiService.getCart(), /Server unavailable/);
(await waitForCall(3)).finish(500, { error: 'Server unavailable' });
await failingRead;
const invalidRead = assert.rejects(ApiService.getCart(), /Invalid cart response/);
(await waitForCall(4)).finish(200, {});
await invalidRead;

const failedWrite = assert.rejects(ApiService.syncCart([row(3)]), /Retry later/);
const retryWrite = ApiService.syncCart([row(4)]);
(await waitForCall(5)).finish(500, { error: 'Retry later' });
await failedWrite;
replyToPut(await waitForCall(6));
assert.equal((await retryWrite).items[0].quantity, 4, 'A failed request must not poison the queue');

const oldInFlight = assert.rejects(ApiService.syncCart([row(7)]), /Expired/);
const oldQueued = assert.rejects(ApiService.syncCart([row(8)]), /session changed/);
const oldCall = await waitForCall(7);
// Simulate the state established by a successful login to another account.
(ApiService as any).authToken = 'account-b';
store.set('authToken', 'account-b');
const newAccountWrite = ApiService.syncCart([row(1)]);
oldCall.finish(401, { error: 'Expired' });
await oldInFlight;
await oldQueued;
const newAccountCall = await waitForCall(8);
assert.equal(calls.length, 9, 'Queued account-A snapshot must never be submitted');
assert.equal(oldCall.auth, 'Bearer account-a');
assert.equal(newAccountCall.auth, 'Bearer account-b');
assert.equal(newAccountCall.body.items[0].quantity, 1);
assert.equal(store.get('authToken'), 'account-b', 'Stale 401 must not clear new account authentication');
assert.equal(location.href, '/#/cart', 'Stale 401 must not redirect the new account');
replyToPut(newAccountCall);
await newAccountWrite;

// A token changed in another tab must also cancel queued writes, even if the
// service instance has not yet observed the new session itself.
const firstB = assert.rejects(ApiService.syncCart([row(9)]), /session changed/);
const queuedB = assert.rejects(ApiService.syncCart([row(10)]), /session changed/);
const firstBCall = await waitForCall(9);
store.set('authToken', 'account-c');
replyToPut(firstBCall);
await firstB;
await queuedB;
await flush();
assert.equal(calls.length, 10);

console.log('Cart API passed: stable entry IDs/time, serial immutable PUTs, GET ordering/errors, retry recovery and account-change cancellation.');
