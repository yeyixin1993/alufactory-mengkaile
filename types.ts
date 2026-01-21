
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

export interface ProfileConfig {
  length: number;
  tapping: TappingConfig;
  holes: DrillHole[];
  variantId?: string;
  finish?: ProfileFinish;
  colorId?: string;
  unitPrice?: number;
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
  date: string;
  items: CartItem[];
  total: number;
  shippingFee: number;
  status: 'pending' | 'processing' | 'shipped';
  userId: string;
  address?: Address;
}
