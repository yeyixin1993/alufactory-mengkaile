import assert from 'node:assert/strict';
import { profileScrewRequirements, reconcileScrewEstimates } from '../utils/screwEstimate';
import { estimateDiyScrewCartItems } from '../utils/cartAccessories';
import { ProductType } from '../types';
const holes = [{id:'a',side:'A',type:'countersunk',positionMm:10},{id:'b',side:'A',type:'countersunk',positionMm:390}] as any;
const profiles = [
  { variantId:'2020-N1',quantity:1,holes }, { variantId:'2020-N1',quantity:1,holes },
  { variantId:'2020',quantity:2,holes },
];
const required = profileScrewRequirements(profiles);
assert.equal(required.length, 1);
assert.equal(required[0].quantity, 8);
const confirmed = [{profileSize:'2020',screwHead:'socket_cylinder',screwLengthMm:30,quantity:6}];
assert.equal(reconcileScrewEstimates(confirmed, required).rows[0].quantity, 10);
assert.equal(confirmed[0].quantity,6,'must not mutate purchased snapshot');
assert.equal(reconcileScrewEstimates([{...confirmed[0],quantity:12}],required).rows[0].quantity,10);
const colors = reconcileScrewEstimates([{...confirmed[0],quantity:3},{...confirmed[0],quantity:3}],required);
assert.equal(colors.rows.reduce((s,r)=>s+r.quantity,0),10,'spares once across color rows');
assert.equal(reconcileScrewEstimates(colors.rows,required).rows.reduce((s,r)=>s+r.quantity,0),10,'idempotent');
assert.equal(reconcileScrewEstimates([],required).missing[0].quantity,10);
const mixed = profileScrewRequirements([{variantId:'3030',quantity:2,holes:[...holes,{id:'c',type:'through'}, {id:'d',type:'threaded'}, {id:'e',type:'through',suppressAutoFastener:true}] as any}]);
assert.deepEqual(mixed.map(r=>r.quantity),[4,2]);
const cart = profiles.map((p,i)=>({id:String(i),product:{type:ProductType.PROFILE},quantity:p.quantity,config:{variantId:p.variantId,holes:p.holes},totalPrice:1})) as any[];
cart.push({id:'s',product:{type:ProductType.ACCESSORY},quantity:1,totalPrice:3,config:{profileSize:'2020',screwHead:'socket_cylinder',screwLengthMm:30,colorId:'natural',totalQuantity:6,lines:[{id:'diy-socket-cylinder-screw',quantity:6,unitPrice:.5,subtotal:3}]}});
const before = JSON.stringify(cart);
const rows = estimateDiyScrewCartItems(cart);
assert.equal(rows.length,1); assert.equal(rows[0].quantity,10); assert.equal(rows[0].totalPrice,3);
assert.equal(JSON.stringify(cart),before);
console.log('PDF case: 2+2+2×2=8 holes; 8+2=10 regardless of prior designer counts. Higher confirmed counts, mixed specs, exclusions, color grouping and unchanged prices passed.');

const { withAutoFilledScrews, synchronizeDesignerSceneItems } = await import('../components/DIYDesigner');
const profile = {id:'profile',kind:'profile',name:'2020',variantId:'2020',length:400,quantity:2,holes,
  position:[0,0,0],rotation:[0,0,0],colorId:'natural'} as any;
const filled = withAutoFilledScrews([profile]);
assert.equal(filled.filter(item=>item.kind==='screw').reduce((sum,item)=>sum+item.quantity,0),4);
const again = withAutoFilledScrews(filled);
assert.equal(again.length,filled.length);
const more = withAutoFilledScrews(filled.map(item=>item.id==='profile'?{...item,holes:[...holes,{...holes[0],id:'new',positionMm:200}]}:item));
assert.equal(more.filter(item=>item.kind==='screw').reduce((sum,item)=>sum+item.quantity,0),6);
const increased = synchronizeDesignerSceneItems(filled.map(item=>item.id==='profile'?{...item,quantity:3}:item));
assert.equal(increased.filter(item=>item.kind==='screw').reduce((sum,item)=>sum+item.quantity,0),6);
console.log('Designer auto-fill: quantity multiplier, repeated fill, new holes and quantity synchronization passed.');

assert.deepEqual(reconcileScrewEstimates(confirmed, []).rows, [], 'no holes means no estimated screws or spares');
assert.equal(reconcileScrewEstimates(confirmed, [{...required[0],quantity:2}]).rows[0].quantity,4, 'removing holes reduces the estimate');
