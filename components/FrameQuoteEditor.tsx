import React,{useState} from 'react';
import {CartItem,Language,Product} from '../types';
import {PROFILE_COLORS,TRANSLATIONS} from '../constants';
import {calculateFrameUnitPrice} from '../utils/framePricing';
export default function FrameQuoteEditor({language,product,initialItem,onSave,saving=false}:{language:Language;product:Product;initialItem?:CartItem;onSave:(item:CartItem)=>void;saving?:boolean}){
 const c=(initialItem?.config||{}) as any,t=TRANSLATIONS[language];
 const [width,setWidth]=useState(c.innerWidth||0),[height,setHeight]=useState(c.innerHeight||0),[quantity,setQuantity]=useState(initialItem?.quantity||1),[kind,setKind]=useState(c.frameType||'wood'),[color,setColor]=useState(c.colorId||'natural');
 const label=(cn:string,en:string,jp:string)=>language==='cn'?cn:language==='en'?en:jp;
 const unit=calculateFrameUnitPrice(width,height);
 const valid=[width,height,quantity].every(n=>Number.isInteger(n)&&n>0&&n<=10000);
 return <div className="p-4 sm:p-8 space-y-5 bg-white rounded-2xl">
 <h3 className="text-xl font-bold">{label('相框配置','Frame configuration','額縁の設定')}</h3>
 <label className="block">{t.qq_frameType}<select className="block w-full border rounded-xl p-3" value={kind} onChange={e=>setKind(e.target.value)}><option value="wood">{t.qq_woodFrame}</option><option value="aluminum">{t.qq_aluFrame}</option><option value="alu_wood">{t.qq_aluWoodFrame}</option></select></label>
 <div className="grid grid-cols-2 gap-3">{[[label('内宽 (mm)','Inner width (mm)','内幅 (mm)'),width,setWidth],[label('内高 (mm)','Inner height (mm)','内高 (mm)'),height,setHeight]].map(([name,value,set]:any)=><label key={name}>{name}<input aria-label={name} type="number" min="1" max="10000" step="1" className="block w-full border rounded-xl p-3" value={value} onChange={e=>set(Number(e.target.value))}/></label>)}</div>
 <label className="block">{label('数量','Quantity','数量')}<input aria-label={label('相框数量','Frame quantity','額縁の数量')} className="block w-full border rounded-xl p-3" type="number" min="1" max="10000" step="1" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label>
 <label className="block">{label('颜色','Color','色')}<select aria-label={label('相框颜色','Frame color','額縁の色')} className="block w-full border rounded-xl p-3" value={color} onChange={e=>setColor(e.target.value)}>{PROFILE_COLORS.map(c=><option key={c.id} value={c.id}>{c.name[language]}</option>)}</select></label>
 <svg viewBox="0 0 360 210" className="w-full h-44 bg-slate-50 rounded-xl" role="img" aria-label={label('相框尺寸预览','Frame dimensions','額縁の寸法')}><rect x="50" y="30" width="260" height="145" fill="white" stroke="#94a3b8" strokeWidth="12"/><text x="180" y="202" textAnchor="middle" fontSize="13">{width} × {height} mm</text></svg>
 <p>{label('小计','Subtotal','小計')} ¥{(unit*quantity).toFixed(1)} · {label('包邮','Shipping included','送料無料')}</p>
 <button disabled={!valid||saving} className="w-full bg-blue-600 text-white p-3 rounded-xl disabled:opacity-40" onClick={()=>onSave({id:initialItem?.id||crypto.randomUUID(),product,quantity,totalPrice:Number((unit*quantity).toFixed(1)),config:{frameType:kind,innerWidth:width,innerHeight:height,width,height,colorId:color,unitPrice:unit} as any})}>{saving?label('保存中…','Saving…','保存中…'):label('保存并确认此项配置','Save and confirm this item','保存してこの項目を確認')}</button>
 </div>;
}
