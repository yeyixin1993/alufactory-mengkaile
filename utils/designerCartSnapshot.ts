import { compressSync, decompressSync, strFromU8, strToU8 } from 'fflate';

// Each row is self-contained, even if sibling cart rows are later removed.
// Compress shared geometry and production detail before persisting in cart/order config.
export const encodeDesignerSnapshot = (document: unknown): string => {
  const bytes = compressSync(strToU8(JSON.stringify(document)));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
export const decodeDesignerSnapshot = (value: string): any => {
  const binary = atob(value);
  return JSON.parse(strFromU8(decompressSync(Uint8Array.from(binary, c => c.charCodeAt(0)))));
};
