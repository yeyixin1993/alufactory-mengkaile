// Shared rates used by the storefront quote editor and printable catalog.
export const PEGBOARD_PRICE_PER_SQM: Record<number, number> = { 1: 780, 2: 1080, 3: 1380, 4: 1680, 5: 1980 };
export const ALUMINUM_PLATE_PRICE_PER_SQM: Record<number, number> = { 1: 500, 2: 700, 3: 1000, 4: 1300, 5: 1600 };
export const VIP_PLUS_PEGBOARD_PRICE_PER_SQM: Record<number, number> = { 1: 400, 2: 520, 3: 720, 4: 920, 5: 1120 };
export const VIP_PLUS_ALUMINUM_PLATE_PRICE_PER_SQM: Record<number, number> = { 1: 300, 2: 420, 3: 600, 4: 780, 5: 960 };
export const MARINE_BOARD_SPEC_PRICE_PER_SQM: Record<'marine_bbb_uv_film' | 'marine_bbb_plain', Record<number, number>> = {
  marine_bbb_uv_film: { 12: 155, 18: 200 },
  marine_bbb_plain: { 12: 136, 18: 176 },
};
export const MARINE_BOARD_COLORED_SURCHARGE_PER_SQM = 100;
export const MIN_BOARD_CHARGE_AREA_SQM = 0.2;
export const MAX_BOARD_WIDTH_MM = 2400;
export const MAX_BOARD_HEIGHT_MM = 1200;
export const MARINE_BOARD_MAX_WIDTH_MM = 2440;
export const MARINE_BOARD_MAX_HEIGHT_MM = 1220;
export const MAX_DOOR_HEIGHT_MM = 3000;
export const MAX_DOOR_WIDTH_MM = 1500;
export const DOOR_HINGE_UNIT_PRICE = 10;

