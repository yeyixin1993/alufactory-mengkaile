import type { CartItem } from '../types';

export const stableSerialize = (value: unknown): string => {
  if (value === null || value === undefined) return String(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableSerialize((value as any)[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

const entryId = (item: CartItem): string => item.config?.cartEntryId || '';
const legacyKey = (item: CartItem) => {
  const { cartEntryId, cartAddedAt, ...config } = item.config || {};
  return `${item.product.id}::${stableSerialize(config)}`;
};
const sameEntry = (a: CartItem, b: CartItem) => {
  if (entryId(a) && entryId(b)) return entryId(a) === entryId(b);
  if (a.id === b.id) return true;
  // An explicitly dated addition is a new purchase action, not a legacy copy.
  if (a.config?.cartAddedAt || b.config?.cartAddedAt) return false;
  return legacyKey(a) === legacyKey(b);
};

/** Reconcile snapshots, never add quantities. Legacy rows match one-to-one. */
export const reconcileCartItems = (local: CartItem[], remote: CartItem[]): CartItem[] => {
  const remaining = [...local];
  const result = remote.map(item => {
    const index = remaining.findIndex(candidate => sameEntry(candidate, item));
    if (index < 0) return item;
    const previous = remaining.splice(index, 1)[0];
    // Retain migration metadata if an older server snapshot has none.
    return { ...item, id: entryId(item) || entryId(previous) || item.id, config: {
      ...item.config,
      ...(entryId(previous) && !entryId(item) ? { cartEntryId: entryId(previous), cartAddedAt: previous.config.cartAddedAt } : {}),
    } };
  });
  return [...result, ...remaining];
};

/** Give legacy rows a durable sync identity, without inventing their addition date. */
export const ensureCartEntryIds = (items: CartItem[]): CartItem[] => items.map(item => {
  const id = entryId(item) || `cart-${item.id}`;
  return { ...item, id, config: { ...item.config, cartEntryId: id } };
});

/** Clean caches follow the server; pending edits (including an empty cart)
 * survive reloads. Preserve local-only rows once when migrating old caches. */
export const restoreCartSnapshot = (local: CartItem[], guest: CartItem[], remote: CartItem[], pending: boolean): CartItem[] => {
  const restored = pending ? local : local.some(item => !entryId(item))
    ? reconcileCartItems(local, remote) : remote;
  return reconcileCartItems(guest, restored);
};

/** Each explicit addition is independently removable. Manufacturing grouping is separate. */
export const prepareCartAdditions = (items: CartItem[], now = new Date().toISOString()): CartItem[] => items.map(item => {
  const id = globalThis.crypto?.randomUUID?.() || `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { ...item, id, config: { ...item.config, cartEntryId: id, cartAddedAt: now } };
});

export const preserveCartEntryMetadata = (previous: CartItem, updated: CartItem): CartItem => ({
  ...updated, id: previous.id,
  config: { ...updated.config, cartEntryId: previous.config?.cartEntryId, cartAddedAt: previous.config?.cartAddedAt },
});

/** Apply edits/deletions/additions made while the initial server GET was pending. */
export const finishCartHydration = (baseline: CartItem[], current: CartItem[], remote: CartItem[]): CartItem[] => {
  const result = [...remote];
  // Resolve matches before applying changes so two identical legacy rows can
  // be edited/deleted independently during a slow GET.
  const unmatched = [...remote];
  const matches = baseline.map(original => {
    const index = unmatched.findIndex(item => sameEntry(item, original));
    return index < 0 ? undefined : unmatched.splice(index, 1)[0];
  });
  for (const [index, original] of baseline.entries()) {
    const latest = current.find(item => item.id === original.id);
    if (!latest || stableSerialize(latest) !== stableSerialize(original)) {
      const matchIndex = matches[index] ? result.indexOf(matches[index]!) : -1;
      if (matchIndex >= 0) result.splice(matchIndex, 1);
      if (latest) result.push(latest);
    }
  }
  for (const item of current) {
    if (!baseline.some(original => original.id === item.id)) {
      const matchIndex = result.findIndex(existing => sameEntry(existing, item));
      if (matchIndex >= 0) result.splice(matchIndex, 1);
      result.push(item);
    }
  }
  return ensureCartEntryIds(result);
};
