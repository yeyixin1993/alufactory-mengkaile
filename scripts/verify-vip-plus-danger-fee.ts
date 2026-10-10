import assert from 'node:assert/strict';
import {calculateQuickProfileRow} from '../utils/quickQuoteProfile';
import {calculatePrice} from '../components/DIYDesigner';
import {PROFILE_VARIANTS} from '../constants';
const rate=PROFILE_VARIANTS.find(v=>v.id==='2020')!.price.oxidized;
for(const membership of ['standard','vip','vip_plus']){
 const discount=membership==='vip_plus'?4:membership==='vip'?2:0;
 for(const length of [21,99,100,101]){
  const fee=length<=100&&membership!=='vip_plus'?5:0;
  const row={id:'fee-test',model:'2020',colorId:'natural',section:'natural' as const,length,quantity:3,tappingCount:0,throughHoleCount:0,countersunkHoleCount:0,threadedHoleCount:0,miter45CutCount:0};
  assert.equal(calculateQuickProfileRow(row,discount,membership).unitPrice,Number((length/1000*(rate-discount)+fee).toFixed(1)));
  assert.equal(calculatePrice({id:'fee-test',kind:'profile',variantId:'2020',length,quantity:3,colorId:'natural',position:[0,0,0],rotation:[0,0,0]} as any,{membershipLevel:membership} as any),Number(((length/1000*(rate-discount)+fee)*3).toFixed(1)));
 }
}
console.log('VIP+ fee waiver and retained standard/VIP fees pass at 21/99/100/101mm.');
