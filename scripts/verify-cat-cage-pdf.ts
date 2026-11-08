import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FactorySheet from '../components/FactorySheet';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeDesignItems, buildImportedComponentCartItem, calculatePrice } from '../components/DIYDesigner';
import { groupFactoryDisplayCartItems } from '../utils/cartAccessories';
import { ProductType } from '../types';
const doc=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const items=normalizeDesignItems(doc.items);
const product={id:'accessory',type:ProductType.ACCESSORY,name:{cn:'配件',en:'Accessory',jp:'部品'},description:{cn:'',en:'',jp:''},basePrice:0,imageUrl:''};
const rows=items.filter(i=>i.kind==='imported_component').map(i=>buildImportedComponentCartItem(i,calculatePrice(i),product,'cn'));
assert(rows.length>0);
const grouped=groupFactoryDisplayCartItems(rows);
const count=(data:any[])=>data.reduce((s,r)=>s+r.config.lines.reduce((n:number,l:any)=>n+l.quantity,0),0);
assert.equal(count(grouped),count(rows));
assert(Math.abs(grouped.reduce((s,r)=>s+r.totalPrice,0)-rows.reduce((s,r)=>s+r.totalPrice,0))<0.01);
console.log(rows.length,'source rows =>',grouped.length,'PDF rows; quantities and prices preserved');

const zeroRows = rows.filter(row => row.totalPrice === 0);
assert(zeroRows.length > 0, 'Fixture must contain unpriced parts');
for (const showPrice of [true, false]) {
  const html = renderToStaticMarkup(React.createElement(FactorySheet, {cart:grouped,user:null,language:'cn',orderRef:'TEST',dateStr:'2026-11-06',showPrice}));
  for (const row of zeroRows) for (const line of row.config.lines) {
    const escaped = renderToStaticMarkup(React.createElement('span',null,line.name)).slice(6,-7);
    assert(html.includes(escaped), 'Unpriced part must appear in production PDF: '+line.name);
  }
  assert(html.includes('暂按 ¥0 计价'));
}
console.log('Every unpriced source part appears in priced and price-free production sheet HTML');
