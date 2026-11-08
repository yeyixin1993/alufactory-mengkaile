import { encodeDesignerSnapshot, decodeDesignerSnapshot } from './designerCartSnapshot';

const PREFIX = 'compressed-cart-v1:';
const memory = new Map<string, unknown[]>();

export const decodeCachedArray = <T,>(raw: string | null): T[] => {
  if (!raw) return [];
  let value = raw.startsWith(PREFIX)
    ? decodeDesignerSnapshot(raw.slice(PREFIX.length)) : JSON.parse(raw);
  if (value && value.format === 'shared-snapshots-v1') {
    const snapshots = value.snapshots;
    value = JSON.parse(JSON.stringify(value.rows), (key, entry) =>
      key === 'designerSnapshot' && entry && typeof entry === 'object'
        ? snapshots[entry.cacheSnapshotIndex] : entry);
  }
  if (!Array.isArray(value)) throw new Error('Invalid cart cache');
  return value;
};

export const readCachedArray = <T,>(key: string): T[] => {
  if (memory.has(key)) return memory.get(key) as T[];
  try { return decodeCachedArray<T>(localStorage.getItem(key)); }
  catch { return []; }
};

export const writeCachedArray = <T,>(key: string, value: T[]) => {
  memory.set(key, value);
  try {
    // Compress the whole cart: repeated per-row design snapshots share one
    // compression dictionary, while every restored row stays self-contained.
    const snapshots: string[] = [];
    const indices = new Map<string, number>();
    const rows = JSON.parse(JSON.stringify(value, (field, entry) => {
      if (field !== 'designerSnapshot' || typeof entry !== 'string') return entry;
      let index = indices.get(entry);
      if (index === undefined) { index = snapshots.length; indices.set(entry, index); snapshots.push(entry); }
      return { cacheSnapshotIndex: index };
    }));
    localStorage.setItem(key, PREFIX + encodeDesignerSnapshot({ format: 'shared-snapshots-v1', snapshots, rows }));
  } catch (error) {
    console.warn('Cart remains in memory; browser cache could not be saved', error);
    window.dispatchEvent(new CustomEvent('cart-cache-unavailable'));
  }
};

export const removeCachedArray = (key: string) => {
  memory.delete(key);
  try { localStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
};

export const acceptCachedArray = <T,>(key: string, raw: string | null): T[] => {
  const value = decodeCachedArray<T>(raw);
  memory.set(key, value);
  return value;
};
