import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openFactorySheetPreview, readFactorySheetPreviewData } from '../components/FactorySheetPreview';
import { decodeDesignerSnapshot } from '../utils/designerCartSnapshot';
const design=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
let saved='',opened=false,warned=false,fail=false, destination='';
const preview = { name:'', opener:{} as unknown, location:{hash:'',replace:(url:string)=>{destination=url;preview.location.hash=new URL(url).hash;}} };
Object.assign(globalThis,{localStorage:{getItem:()=>saved,setItem:(_k:string,v:string)=>{if(fail)throw new Error('quota');saved=v}},
  sessionStorage:{setItem:()=>{throw new Error('session quota');},getItem:()=>null},
  window:{location:{origin:'http://localhost:3000',pathname:'/',hash:''},name:'',open:()=>{opened=true;return preview}},alert:()=>{warned=true}});
const cart=Array.from({length:100},(_,id)=>({id,quantity:1,config:{designerSnapshot:JSON.stringify(design),remark:'待核',length:1280}}));
openFactorySheetPreview({cart:cart as any,user:null,language:'cn'});
assert(opened);
const decoded=decodeDesignerSnapshot(JSON.parse(saved).data);
assert.equal(decoded.cart.length,100);
assert.equal(decoded.cart[0].config.length,1280);
assert(!('designerSnapshot' in decoded.cart[0].config));
assert(cart[0].config.designerSnapshot);
assert(saved.length<100000);
fail=true;opened=false;openFactorySheetPreview({cart:cart as any,user:null,language:'cn'});
assert(opened && !warned, 'full localStorage must not block production preview');
assert.equal(preview.opener,null);
assert(destination.startsWith('http://localhost:3000/#/preview?transfer='));
Object.assign(globalThis,{window:preview});
for(let read=0;read<2;read++) {
  const transferred = readFactorySheetPreviewData();
  assert.equal(transferred.cart.length,100, 'even full sessionStorage and React repeated initialization retain the payload');
  assert.equal(transferred.cart[0].config.length,1280);
}
assert.equal(preview.name,'', 'the temporary handoff must be consumed before another navigation');
console.log('Preview compression, complete production data, storage-full tab handoff and repeated initialization passed:',saved.length);
