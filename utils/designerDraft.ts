// Local, per-account convenience draft. JSON downloads remain the portable backup.
export const designerDraftKey = (userId?: string) => `mengkaile:diy-draft:v1:${userId ? `user:${userId}` : 'guest'}`;

export const readDesignerDraft = <T>(storage: Pick<Storage, 'getItem'>, key: string): T[] => {
  const raw = storage.getItem(key);
  if (!raw) return [];
  const document = JSON.parse(raw);
  if (document.format !== 'mengkaile-diy-draft' || document.schemaVersion !== 1 || !Array.isArray(document.items)) {
    throw new Error('Invalid designer draft');
  }
  return document.items;
};

export const writeDesignerDraft = <T>(storage: Pick<Storage, 'setItem' | 'removeItem'>, key: string, items: T[]) => {
  if (!items.length) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, JSON.stringify({ format: 'mengkaile-diy-draft', schemaVersion: 1, savedAt: new Date().toISOString(), items }));
};
