export const ACCESSORY_BULK_THRESHOLD = 20;

export const END_CAP_PRICES = {
  '2020': { retail: 3, bulk: 2.7 },
  '3030': { retail: 4, bulk: 3.5 },
} as const;

export type ConfirmedEndCapProfileSize = keyof typeof END_CAP_PRICES;

export const getConfirmedEndCapUnitPrice = (
  profileSize: string | undefined,
  quantity = 1,
): number | null => {
  const prices = END_CAP_PRICES[profileSize as ConfirmedEndCapProfileSize];
  if (!prices) return null;
  return quantity >= ACCESSORY_BULK_THRESHOLD ? prices.bulk : prices.retail;
};

export const hasConfirmedEndCapPrice = (
  profileSize: string | undefined,
): profileSize is ConfirmedEndCapProfileSize => profileSize === '2020' || profileSize === '3030';
