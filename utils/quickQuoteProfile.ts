import { PROFILE_VARIANTS, PROFILE_WEIGHTS } from '../constants';
export interface QuickProfileRow {id:string;model:string;colorId:string;section:'natural'|'colored';length:number;quantity:number;tappingCount:number;throughHoleCount:number;countersunkHoleCount:number;threadedHoleCount:number;miter45CutCount:number;}
const safe = (v:number) => Number.isFinite(v) ? Math.max(0,v) : 0;
const round = (v:number) => Number(v.toFixed(1));
export function calculateQuickProfileRow<T extends QuickProfileRow>(row:T, discount:number) {
  const variant = PROFILE_VARIANTS.find(v=>v.id===row.model)||PROFILE_VARIANTS[0];
  const finish = row.colorId==='natural'?'oxidized':row.section==='natural'?'electrophoretic':'powder';
  const length = Math.min(3000,safe(row.length));
  const rate = Math.max(0,variant.price[finish]-discount);
  const process = safe(row.tappingCount)*1.5+safe(row.throughHoleCount)+safe(row.countersunkHoleCount)*1.8+safe(row.threadedHoleCount)*1.8+safe(row.miter45CutCount);
  const unitPrice=round(length/1000*rate+process+(row.length>0&&row.length<=100?5:0));
  const qty=safe(row.quantity||0);
  return {row,unitPrice,subtotal:round(unitPrice*qty),totalWeightKg:(PROFILE_WEIGHTS[row.model]||0.6)*length/1000*qty};
}
