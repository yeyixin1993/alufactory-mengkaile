
export type Language = 'en' | 'cn' | 'jp';

export enum ProductType {
  PEGBOARD = 'PEGBOARD',
  PROFILE = 'PROFILE',
  CABINET_DOOR = 'CABINET_DOOR',
  FRAME = 'FRAME'
}

export interface Product {
  id: string;
  type: ProductType;
  name: Record<Language, string>;
  description: Record<Language, string>;
  basePrice: number;
  imageUrl: string;
}

export interface Address {
  id: string;
  recipient_name: string;
  phone: string;
  province: string;
  detail: string;
  isDefault?: boolean;
}

export interface User {
  id: string; // Phone number
  name: string;
  password?: string;
  role: 'admin' | 'customer';
  membershipLevel?: 'standard' | 'vip' | 'vip_plus' | string;
  addresses: Address[];
}

// Profile Specifics
export type ProfileSide = 'A' | 'B' | 'C' | 'D';
export type HoleType = 'through' | 'countersunk';
export type ProfileFinish = 'oxidized' | 'electrophoretic' | 'powder';

export interface TappingConfig {
  left: boolean[];
  right: boolean[];
}

export interface DrillHole {
  id: string;
  side: ProfileSide;
  positionMm: number;
  type: HoleType;
  grooveIndex?: number;
}

export interface ProfileVariant {
  id: string;
  name: string;
  wallThickness: number;
  price: {
    oxidized: number;
    electrophoretic: number; 
    powder: number; 
  };
}

export interface ColorDef {
  id: string;
  name: Record<Language, string>;
  maxLength: number;
}

export type MiterCutDirection = 'up' | 'down';
export type MiterCutSide = 'AC' | 'BD';

export interface MiterCutEnd {
  enabled: boolean;
  direction: MiterCutDirection;
  side: MiterCutSide;
}

export interface MiterCutConfig {
  left: MiterCutEnd;
  right: MiterCutEnd;
}

export interface ProfileConfig {
  length: number;
  tapping: TappingConfig;
  holes: DrillHole[];
  variantId?: string;
  finish?: ProfileFinish;
  colorId?: string;
  unitPrice?: number;
  miterCut?: MiterCutConfig;
}

export interface Rect {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  color?: string;
}

export interface PlateConfig {
  items: Rect[];
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  config: ProfileConfig | PlateConfig | any;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber?: string;
  date: string;
  items: CartItem[];
  total: number;
  shippingFee: number;
  overlengthFee?: number;
  shippingMethod?: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  userId: string;
  address?: Address;
  addressId?: string;
  trackingNumber?: string;
  memo?: string;
  adminMemo?: string;
  updatedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
}
