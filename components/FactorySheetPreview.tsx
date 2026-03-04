
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
  overlengthFee?: number;
}

/**
 * Opens the factory sheet preview in a new browser window.
 * Stores necessary data in sessionStorage, then navigates to /#/preview.
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
    overlengthFee: props.overlengthFee,
  };
  localStorage.setItem('__factorySheetPreviewData', JSON.stringify(payload));

  // Open in a new window/tab
  const url = `${window.location.origin}${window.location.pathname}#/preview`;
  window.open(url, '_blank', 'noopener');
};

export { openFactorySheetPreview };
export type { FactorySheetPreviewProps };
export default openFactorySheetPreview;
