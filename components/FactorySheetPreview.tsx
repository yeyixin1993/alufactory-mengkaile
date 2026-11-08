import { encodeDesignerSnapshot } from '../utils/designerCartSnapshot';

import { CartItem, User, Language, Address } from '../types';
import { TRANSLATIONS } from '../constants';

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
 * Stores compressed production data in localStorage, then navigates to /#/preview.
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
  try {
    localStorage.setItem('__factorySheetPreviewData', JSON.stringify({
      format: 'compressed-preview-v1', data: encodeDesignerSnapshot(productionPayload),
    }));
  } catch (error) {
    console.error('Unable to save production preview', error);
    alert('浏览器存储空间不足，无法打开生产单预览。购物车数据仍保留，请从购物车直接下载 PDF。');
    return;
  }

  // Open in a new window/tab
  const url = `${window.location.origin}${window.location.pathname}#/preview`;
  window.open(url, '_blank', 'noopener');
};

export { openFactorySheetPreview };
export type { FactorySheetPreviewProps };
export default openFactorySheetPreview;
