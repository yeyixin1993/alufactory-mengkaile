import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateQuickProfileRow} from '../utils/quickQuoteProfile';
const fixture=JSON.parse(readFileSync('alufactory-backend/tests/ai_multi_fixture.json','utf8'));
for(const [discount,expected] of [[0,1005.4],[2,893.3],[4,783.9]]) {
 const sum=fixture.items.reduce((total:number,s:any)=>total+calculateQuickProfileRow({id:'test',model:s.model,colorId:s.color,section:s.color==='natural'?'natural':'colored',length:s.length,quantity:s.quantity,tappingCount:0,throughHoleCount:0,countersunkHoleCount:0,threadedHoleCount:0,miter45CutCount:0},discount).subtotal,0);
 assert.equal(Number(sum.toFixed(1)),expected);
}
const holes=calculateQuickProfileRow({id:'holes',model:'2020',colorId:'natural',section:'natural',length:610,quantity:2,tappingCount:0,throughHoleCount:2,countersunkHoleCount:0,threadedHoleCount:0,miter45CutCount:0},0);
assert.equal(holes.subtotal,23.6);
console.log('Shared QuickQuote / AI profile pricing: PASS');

const tapped=fixture.items.map((s:any)=>calculateQuickProfileRow({id:'tap',model:s.model,colorId:s.color,section:s.color==='natural'?'natural':'colored',length:s.length,quantity:s.quantity,tappingCount:2,throughHoleCount:0,countersunkHoleCount:0,threadedHoleCount:0,miter45CutCount:0},0));
assert.equal(Number(tapped.reduce((n:number,r:any)=>n+r.subtotal,0).toFixed(1)),1347.4);
assert.equal(tapped.reduce((n:number,r:any)=>n+r.row.tappingCount*r.row.quantity,0),228);

// Customer's 9-line Hubei list: multi-port tapping, split A/B holes and short cuts.
const customerRows: [string,number,number,number,number][] = [
 ['2040-N1-40',360,2,4,0],['2040-N1-40',860,2,4,0],
 ['2020-N2',1000,1,2,1],['2020-N2',1000,1,2,1],
 ['2020-N2',90,1,2,1],['2020-N2',90,1,2,1],
 ['2020-N2',860,3,0,0],['2020',360,3,0,0],['2020-N2',300,2,2,1],
];
const customerTotal=customerRows.reduce((sum,[model,length,quantity,tappingCount,throughHoleCount])=>sum+calculateQuickProfileRow({id:'customer',model,colorId:'natural',section:'natural',length,quantity,tappingCount,throughHoleCount,countersunkHoleCount:0,threadedHoleCount:0,miter45CutCount:0},0).subtotal,0);
assert.equal(Number(customerTotal.toFixed(1)),242.5);
console.log('Customer Hubei list: materials + machining = 242.50 PASS');
