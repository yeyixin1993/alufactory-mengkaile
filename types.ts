
export type Language = 'en' | 'cn' | 'jp';

export enum ProductType {
  PEGBOARD = 'PEGBOARD',
  PROFILE = 'PROFILE',
  CABINET_DOOR = 'CABINET_DOOR',
  FRAME = 'FRAME',
  ALUMINUM_PLATE = 'ALUMINUM_PLATE',
  MARINE_BOARD = 'MARINE_BOARD',
  CALLIGRAPHY_CABINET = 'CALLIGRAPHY_CABINET',
  WARDROBE = 'WARDROBE',
  DISPLAY_RACK_3_0 = 'DISPLAY_RACK_3_0',
  ACCESSORY = 'ACCESSORY'
}

export interface Product {
  id: string;
  type: ProductType;
  category?: 'finished_furniture';
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
export type HoleType = 'through' | 'countersunk' | 'threaded';
export type ThreadSize = 'M3' | 'M4' | 'M5' | 'M6' | 'M8';
export type ScrewHeadType = 'socket_cylinder' | 'button_socket' | 'flat_socket';
export type ProfileFinish = 'oxidized' | 'electrophoretic' | 'powder';

export interface TappingConfig {
  left: boolean[];
  right: boolean[];
}

export interface DrillHole {
  id: string;
  // Stable generated-joint identity. It makes one-click connection generation
  // idempotent while keeping the hole editable like an ordinary manual hole.
  jointKey?: string;
  side: ProfileSide;
  positionMm: number;
  type: HoleType;
  // Optional physical bore diameter retained by imported/parametric models.
  // Ordinary manually placed holes continue to use the designer default.
  diameterMm?: number;
  // Process/pass-through holes such as linear-shaft passages must remain holes
  // only and must never be interpreted as screw connection points.
  suppressAutoFastener?: boolean;
  threadSize?: ThreadSize;
  // Optional fastener override for parametric joints. Ordinary manually added
  // holes continue to use the default hole-type-to-screw mapping.
  fastenerHead?: ScrewHeadType;
  fastenerLengthMm?: number;
  // Ordinary screws enter the source profile from the marked face. A value
  // of "outward" is used when the marked through-hole is the exit side and
  // the screw must travel from that face into an adjacent tapped profile.
  fastenerDirection?: 'inward' | 'outward';
  // Canonical slot on the physical extrusion. C/D face drawings mirror this index.
  physicalGrooveIndex?: number;
  // Entry-face display index retained for older saved orders and human-readable exports.
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
  remark?: string;
  labelService?: boolean;
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

export type DesignSourceChannel =
  | 'sketchup_plugin'
  | 'parametric_template'
  | 'maycad_scene'
  | 'production_xlsx'
  | 'designer_json'
  | 'system_order'
  | 'manual_designer'
  | 'external_json'
  | 'mixed'
  | 'legacy_unspecified';

/**
 * Portable, non-secret provenance carried by design JSON, cart rows and order
 * item configs. `self_declared` is intentional: authenticity can only become
 * `server_verified` after a future authenticated website hand-off.
 */
export interface DesignSourceInfo {
  schemaVersion: 1;
  channel: DesignSourceChannel;
  producerId: string;
  producerVersion?: string;
  documentId: string;
  modelName?: string;
  exportedAt?: string;
  importedAt?: string;
  sourceSummary?: string;
  warningsCount?: number;
  containedChannels: DesignSourceChannel[];
  verification: 'local' | 'self_declared' | 'legacy_inferred' | 'server_verified';
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
  screwFee?: number;
  include304Screws?: boolean;
  labelFee?: number;
  includeLabelService?: boolean;
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
