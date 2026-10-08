// Short-lived, same-origin handoff; attachments never appear in URLs.
export type ChatAttachment = {name:string; data:string; kind:'image'|'file'};
export type ChatDraft = { text: string; image?: string | null; attachments?:ChatAttachment[]; newConversation?:boolean; owner: string; created: number };
const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open('mengkaile-ai-handoff', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('drafts');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(new Error('无法暂存消息，请允许浏览器存储后重试。'));
});
export async function saveChatDraft(id: string, draft: ChatDraft) {
  const db = await openDb();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite');
    const store = tx.objectStore('drafts');
    const cursor = store.openCursor();
    cursor.onsuccess = () => { const row = cursor.result; if (row) { if (Date.now() - row.value.created > 600000) row.delete(); row.continue(); } };
    store.put(draft, id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  }); } finally { db.close(); }
}
export async function takeChatDraft(id: string): Promise<ChatDraft | undefined> {
  const db = await openDb();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite'); const store = tx.objectStore('drafts');
    let draft: ChatDraft | undefined;
    const req = store.get(id); req.onsuccess = () => { draft = req.result; store.delete(id); };
    tx.oncomplete = () => resolve(draft && Date.now() - draft.created < 600000 ? draft : undefined);
    tx.onerror = () => reject(tx.error);
  }); } finally { db.close(); }
}
