import { writeFileSync } from 'node:fs';
import { PROFILE_VARIANTS, PROFILE_COLORS, PROFILE_WEIGHTS, SHIPPING_RATES, SHIPPING_RATES_SF, SHIPPING_RATES_AN, COLOR_ONLY_COLORED_SECTION_IDS } from '../constants';

// Run from repository root. Backend quotes never accept a client-supplied catalog.
writeFileSync('alufactory-backend/app/ai_catalog.json', JSON.stringify({
  variants: PROFILE_VARIANTS, colors: PROFILE_COLORS.map(({ id, name, maxLength }) => ({ id, name, maxLength })),
  weights: PROFILE_WEIGHTS, shipping: { standard: SHIPPING_RATES, sf: SHIPPING_RATES_SF, anneng: SHIPPING_RATES_AN },
  coloredSectionOnly: COLOR_ONLY_COLORED_SECTION_IDS,
}, null, 2) + '\n');
