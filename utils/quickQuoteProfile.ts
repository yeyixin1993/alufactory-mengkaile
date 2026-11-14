import { COLOR_ONLY_COLORED_SECTION_IDS, PROFILE_VARIANTS, PROFILE_WEIGHTS } from '../constants';
import { getAPillarMillingSpec, normalizeAPillarMilling, type APillarMillingOption } from '../data/aPillarMilling';

export interface QuickProfileRow {id:string;model:string;colorId:string;section:'natural'|'colored';length:number;quantity:number;tappingCount:number;throughHoleCount:number;countersunkHoleCount:number;threadedHoleCount:number;miter45CutCount:number;aPillarMilling?:APillarMillingOption;}
const safe = (v:number) => Number.isFinite(v) ? Math.max(0,v) : 0;
const round = (v:number) => Number(v.toFixed(1));

/** Apply the same machining/finish constraints for editing and for pricing. */
export function normalizeQuickProfileRow<T extends QuickProfileRow>(row: T): T {
  const aPillarMilling = normalizeAPillarMilling(row.model, row.aPillarMilling);
  const section = row.colorId === 'natural'
    ? 'natural'
    : aPillarMilling !== 'none' || COLOR_ONLY_COLORED_SECTION_IDS.includes(row.colorId as any)
      ? 'colored'
      : row.section;
  return { ...row, aPillarMilling, section };
}

export function calculateQuickProfileRow<T extends QuickProfileRow>(input:T, discount:number, membership:string = 'standard') {
  const row = normalizeQuickProfileRow(input);
  const variant = PROFILE_VARIANTS.find(v=>v.id===row.model)||PROFILE_VARIANTS[0];
  const finish = row.colorId==='natural'?'oxidized':row.section==='natural'?'electrophoretic':'powder';
  const length = Math.min(3000,safe(row.length));
  const rate = Math.max(0,variant.price[finish]-discount);
  const aPillarMillingRate = getAPillarMillingSpec(row.model, row.aPillarMilling)?.feePerMeter || 0;
  const process = safe(row.tappingCount)*1.5+safe(row.throughHoleCount)+safe(row.countersunkHoleCount)*1.8+safe(row.threadedHoleCount)*1.8+safe(row.miter45CutCount);
  const unitPrice=round(length/1000*(rate+aPillarMillingRate)+process+(membership!=='vip_plus'&&row.length>0&&row.length<=100?5:0));
  const qty=safe(row.quantity||0);
  return {row,unitPrice,subtotal:round(unitPrice*qty),aPillarMillingRate,aPillarMillingFee:round(length/1000*qty*aPillarMillingRate),totalWeightKg:(PROFILE_WEIGHTS[row.model]||0.6)*length/1000*qty};
}
