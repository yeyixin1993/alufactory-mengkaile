import { INITIAL_PRODUCTS } from '../constants';
import { ProductType, type CartItem } from '../types';
import {
  expandFinishedFurnitureCartItems,
  isFinishedFurnitureCartItem,
} from '../utils/finishedFurnitureCart';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const rackProduct = INITIAL_PRODUCTS.find((product) => product.id === 'p9')!;
const profileProduct = INITIAL_PRODUCTS.find((product) => product.id === 'p0')
  || INITIAL_PRODUCTS.find((product) => product.type === ProductType.PROFILE)!;
const accessoryProduct = {
  ...rackProduct,
  id: 'accessory',
  type: ProductType.ACCESSORY,
};
const productionItems: CartItem[] = [
  {
    id: 'profile-line',
    product: profileProduct,
    quantity: 1,
    totalPrice: 100,
    config: { variantId: '3030', length: 2000, unitPrice: 100, hideComponentPrice: true },
  },
  {
    id: 'accessory-line',
    product: accessoryProduct,
    quantity: 1,
    totalPrice: 50,
    config: {
      type: 'profile_accessory',
      totalQuantity: 3,
      unitTotal: 50,
      quantities: { sk8: 3 },
      lines: [{ id: 'sk8', quantity: 3, unitPrice: 50 / 3, subtotal: 50 }],
      hideComponentPrice: true,
    },
  },
];
const furnitureItem: CartItem = {
  id: 'rack-order-line',
  product: rackProduct,
  quantity: 2,
  totalPrice: 300,
  config: {
    type: 'finished_furniture',
    unitPrice: 150,
    finishedFurnitureCategory: 'finished_furniture',
    finishedFurnitureSource: 'display_rack_3_0',
    finishedFurnitureProductId: 'p9',
    finishedFurnitureTotalCny: 150,
    parametricSummary: { widthMm: 800, depthMm: 450, heightMm: 2000 },
    productionItems,
    hideComponentPrice: true,
  },
};

assert(isFinishedFurnitureCartItem(furnitureItem), 'finished-furniture cart row was not recognized');
const expanded = expandFinishedFurnitureCartItems([furnitureItem]);
assert(expanded.length === 2, 'finished-furniture row did not expand to its two production lines');
assert(expanded.reduce((sum, item) => sum + item.totalPrice, 0) === 300, 'expanded BOM total no longer matches the furniture total');
assert(expanded[0].quantity === 2, 'profile production quantity did not follow furniture quantity');
assert(expanded[1].config.totalQuantity === 6, 'accessory total quantity did not follow furniture quantity');
assert(expanded[1].config.lines[0].quantity === 6, 'accessory detail quantity did not follow furniture quantity');
assert(expanded[1].config.lines[0].subtotal === 100, 'accessory subtotal did not follow furniture quantity');
assert(expanded.every((item) => item.config.hideComponentPrice === true), 'expanded BOM exposed a component price flag');

const ordinaryItem = productionItems[0];
assert(expandFinishedFurnitureCartItems([ordinaryItem])[0] === ordinaryItem, 'ordinary cart rows must pass through unchanged');

console.log('Finished-furniture cart regression checks passed.');
