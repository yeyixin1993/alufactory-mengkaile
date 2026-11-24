import { decodeDesignerSnapshot, encodeDesignerSnapshot } from '../utils/designerCartSnapshot';

import { CartItem, User, Language, Address } from '../types';

const PREVIEW_KEY = '__factorySheetPreviewData';
const TRANSFER_PREFIX = '__factorySheetTransfer:';
let consumedTransfer: { id: string; raw: string } | undefined;

/** A storage-full preview receives data on the new same-origin window before
 * navigation. Consume its name immediately; a tab-scoped copy permits reload. */
export const readFactorySheetPreviewData = () => {
  try {
    const transferId = new URLSearchParams(window.location.hash.split('?')[1] || '').get('transfer');
    let raw: string | null;
    if (transferId) {
      const key = `${PREVIEW_KEY}:${transferId}`;
      const prefix = `${TRANSFER_PREFIX}${transferId}:`;
      if (window.name.startsWith(prefix)) {
        raw = window.name.slice(prefix.length);
        consumedTransfer = { id: transferId, raw };
        window.name = '';
        try { sessionStorage.setItem(key, raw); } catch { /* Current preview still works in memory. */ }
      } else {
        raw = consumedTransfer?.id === transferId ? consumedTransfer.raw : sessionStorage.getItem(key);
      }
    } else {
      raw = localStorage.getItem(PREVIEW_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.format === 'compressed-preview-v1' ? decodeDesignerSnapshot(parsed.data) : parsed;
  } catch { return null; }
};

interface FactorySheetPreviewProps {
  cart: CartItem[];
  user: User | null;
  language: Language;
  onClose: () => void;
  onDownload: () => void;
  showPrice?: boolean;
  address?: Address;
  shippingMethod?: string;
  shippingFee?: number;
  include304Screws?: boolean;
  includeLabelService?: boolean;
  labelFee?: number;
  overlengthFee?: number;
}

/**
 * Opens the factory sheet preview in a new browser window.
 * Stores compressed production data, with a same-origin tab handoff when full.
 */
const openFactorySheetPreview = (props: Omit<FactorySheetPreviewProps, 'onClose' | 'onDownload'>) => {
  const payload = {
    cart: props.cart,
    user: props.user,
    language: props.language,
    showPrice: props.showPrice ?? true,
    address: props.address,
    shippingMethod: props.shippingMethod,
    shippingFee: props.shippingFee,
    include304Screws: props.include304Screws,
    includeLabelService: props.includeLabelService,
    labelFee: props.labelFee,
    overlengthFee: props.overlengthFee,
  };
  // Reopening the editor needs mesh snapshots; the production sheet does not.
  // Strip only that metadata, retaining all manufacturing and nested furniture rows.
  const productionPayload = JSON.parse(JSON.stringify(payload, (key, value) =>
    key === 'designerSnapshot' ? undefined : value));
  const serialized = JSON.stringify({ format: 'compressed-preview-v1', data: encodeDesignerSnapshot(productionPayload) });
  const url = `${window.location.origin}${window.location.pathname}#/preview`;
  try {
    localStorage.setItem(PREVIEW_KEY, serialized);
  } catch {
    const preview = window.open('', '_blank');
    if (!preview) {
      alert(props.language === 'cn' ? '请允许弹出窗口后重试生产单预览。' : props.language === 'jp' ? 'ポップアップを許可してから再試行してください。' : 'Allow pop-ups and try the production preview again.');
      return;
    }
    const id = crypto.randomUUID();
    preview.name = `${TRANSFER_PREFIX}${id}:${serialized}`;
    preview.opener = null;
    preview.location.replace(`${url}?transfer=${id}`);
    return;
  }

  // Open in a new window/tab
  window.open(url, '_blank', 'noopener');
};

export { openFactorySheetPreview };
export type { FactorySheetPreviewProps };
export default openFactorySheetPreview;
