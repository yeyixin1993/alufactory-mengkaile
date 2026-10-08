import { MARINE_BOARD_COLORS } from '../constants';
import { BOARD_PRODUCT_RULES } from '../data/boardProductRules';
import * as quickQuote from '../utils/quickQuoteCatalog';
import { CUSTOMER_ACCESSORY_ROWS } from '../data/accessoryCatalog';
import { ACCESSORY_BULK_THRESHOLD } from '../utils/accessoryPricing';
import { getProfileGrooveCount } from '../utils/profileMachining';
import { writeFileSync } from 'node:fs';
import { PROFILE_VARIANTS, PROFILE_COLORS, PROFILE_WEIGHTS, SHIPPING_RATES, SHIPPING_RATES_SF, SHIPPING_RATES_AN, COLOR_ONLY_COLORED_SECTION_IDS } from '../constants';

// Run from repository root. Backend quotes never accept a client-supplied catalog.
writeFileSync('alufactory-backend/app/ai_catalog.json', JSON.stringify({
  boardRules: BOARD_PRODUCT_RULES, marineColors: MARINE_BOARD_COLORS, quickQuote, accessories: CUSTOMER_ACCESSORY_ROWS, accessoryBulkThreshold: ACCESSORY_BULK_THRESHOLD,
  grooves: Object.fromEntries(PROFILE_VARIANTS.map(v => [v.id, Object.fromEntries((['A','B','C','D'] as const).map(side => [side, getProfileGrooveCount(v.id, side)]))])),
  variants: PROFILE_VARIANTS, colors: PROFILE_COLORS.map(({ id, name, maxLength }) => ({ id, name, maxLength })),
  weights: PROFILE_WEIGHTS, shipping: { standard: SHIPPING_RATES, sf: SHIPPING_RATES_SF, anneng: SHIPPING_RATES_AN },
  coloredSectionOnly: COLOR_ONLY_COLORED_SECTION_IDS,
}, null, 2) + '\n');
