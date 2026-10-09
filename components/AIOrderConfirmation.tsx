import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useNavigate} from 'react-router-dom';
import {CartItem,User} from '../types';
import {INITIAL_PRODUCTS} from '../constants';
import {useAIText} from '../utils/aiLocale';
import {ApiService} from '../services/apiService';
import BoardQuoteEditor from './BoardQuoteEditor';
import FrameQuoteEditor from './FrameQuoteEditor';
import ProfileEditor from './ProfileEditor';
const productIds:Record<string,string>={profile:'p2',aluminum_plate:'p5',pegboard:'p1',marine_board:'p6',cabinet_door:'p3',frame:'p4'};
export default function AIOrderConfirmation({message,active,user,cart,onAdd,onEdited,visitorToken}:{message:any;active:boolean;user:User|null;cart:CartItem[];onAdd?:(items:CartItem[],mode?:'append'|'replace')=>void;onEdited:(result:any)=>void;visitorToken:string}){
 const {language}=useAIText(),navigate=useNavigate();
 const label=(cn:string,en:string,jp:string)=>language==='cn'?cn:language==='en'?en:jp;
 const source=message.quote.source_spec||message.quote.spec;
 const rows=source?.items||[source];
 const checked:number[]=message.order_confirmed||[];
 const [index,setIndex]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[choose,setChoose]=useState(false),[accepted,setAccepted]=useState(false),[drafts,setDrafts]=useState<CartItem[]>([]);
 const dialog=useRef<HTMLDivElement>(null);
 useEffect(()=>{setAccepted(false);setIndex(null);setChoose(false);},[message.order_revision,active]);
 useEffect(()=>{
  if(index===null&&!choose)return;
  const before=document.activeElement as HTMLElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy){setIndex(null);setChoose(false);}if(e.key==='Tab'){const elements:HTMLElement[]=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')||[]);const first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);before?.focus();};
 },[index,choose,busy]);
 const request=(extra:any)=>ApiService.aiRequest('/order-configuration',{request_id:message.request_id,visitor_token:visitorToken,revision:message.order_revision||0,...extra});
 const initial=(i:number):CartItem=>{
  const r=rows[i],kind=r.product||'profile';const priced=message.quote.items?.find((v:any)=>v.source_index===i);
  const cfg=kind==='profile'?{variantId:r.model,length:r.length,colorId:r.color,finish:r.color==='natural'?'oxidized':r.section==='colored'?'powder':'electrophoretic',holes:r.holes||[],tapping:r.tapping_ports||{left:[['left','both'].includes(r.tapping)],right:[['right','both'].includes(r.tapping)]},miterCut:r.miter_cut}:kind==='frame'?{frameType:r.frame_type,innerWidth:r.inner_width,innerHeight:r.inner_height,colorId:r.color}:{width:r.width,height:r.height,thickness:r.thickness,colorId:r.color,marineSpecId:r.marine_spec,openingSide:r.opening_side};
  return {id:`ai-${message.request_id}-${i}`,product:INITIAL_PRODUCTS.find(p=>p.id===productIds[kind])!,quantity:r.quantity||1,totalPrice:priced?.subtotal||0,config:cfg as any};
 };
 const save=async(item:CartItem)=>{setBusy(true);setError('');try{const result=await request({source_index:index,config:item.config,quantity:item.quantity});onEdited(result);setIndex(null);}catch(e:any){setError(e.message);}finally{setBusy(false);}};
 const add=async(mode?:'append'|'replace')=>{
  if(!accepted||!active)return;if(cart.length&&!mode){setChoose(true);return;}setBusy(true);setError('');
  try{const result=await request({action:'cart',confirmed:true});if(!onAdd)throw new Error(label('购物车暂不可用','Cart unavailable','カートを利用できません'));const items=result.items.map((r:any,i:number)=>{const product=INITIAL_PRODUCTS.find(p=>p.id===r.product_id);if(!product)throw new Error('Unknown product');return {id:`ai-confirmed-${message.request_id}-${i}`,product,quantity:r.quantity,totalPrice:r.totalPrice,config:r.config};});onAdd(items,mode||'append');navigate('/cart');}catch(e:any){setError(e.message);}finally{setBusy(false);setChoose(false);}
 };
 const ready=rows.length>0&&rows.every((_:any,i:number)=>checked.includes(i));
 if(!source)return null;
 const item=index===null?null:initial(index);
 return <div className="mt-5 space-y-3 border-t pt-4">
 <h4 className="font-bold">{label('确认下单配置','Confirm order configuration','注文仕様の確認')}</h4>
 <p className="text-sm text-slate-500">{label('已填入报价规格，点开核对颜色、尺寸及选项，保存后加入购物车。','Quote specifications are filled in. Review each item, save, then add to cart.','見積仕様を入力済みです。各項目を確認・保存してからカートに追加してください。')}</p>
 {rows.map((r:any,i:number)=>{const p=INITIAL_PRODUCTS.find(p=>p.id===productIds[r.product||'profile']);return <button key={i} disabled={!active||busy||!p} className="w-full flex justify-between items-center text-left p-3 rounded-xl border bg-white disabled:opacity-50" onClick={()=>{setError('');setIndex(i);}}><span>{i+1}. {p?.name[language]||label('其他商品','Other item','その他')} · {r.width||r.inner_width||r.length||'?'}{r.height||r.inner_height?` × ${r.height||r.inner_height}`:''}mm × {r.quantity||'?'}</span><span className="text-blue-600 text-sm">{checked.includes(i)?label('已确认 · 编辑','Confirmed · Edit','確認済み・編集'):label('查看并确认','Review','確認する')}</span></button>;})}
 {active&&<><label className="flex gap-2 items-center text-sm"><input type="checkbox" disabled={!ready||busy} checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>{label('已核对全部配置，确认加入购物车','I have checked all configurations','すべての仕様を確認しました')} ({checked.length}/{rows.length})</label><button disabled={!ready||!accepted||busy} onClick={()=>void add()} className="bg-blue-600 text-white px-5 py-3 rounded-xl disabled:opacity-40">{label('确认配置，加入购物车','Add confirmed items to cart','確認してカートに追加')}</button></>}
 {error&&<p role="alert" className="text-red-600">{error}</p>}
 {(item||choose)&&createPortal(<div className="fixed inset-0 z-[210] bg-slate-900/40 flex items-center justify-center p-3" role="presentation"><div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label('确认商品配置','Confirm item configuration','商品仕様を確認')} className="bg-white rounded-2xl w-full max-w-4xl max-h-[92dvh] overflow-y-auto p-4">
 <button disabled={busy} className="block ml-auto p-2 text-slate-600" onClick={()=>{setIndex(null);setChoose(false);}}>{label('关闭','Close','閉じる')} ×</button>
 {error&&<p role="alert" className="text-red-600">{error}</p>}
 {choose?<div className="p-5 space-y-4"><h3 className="text-xl font-bold">{label('购物车已有商品','Your cart already has items','カートに商品があります')}</h3><p>{label('追加会保留原商品；替换只保留本次清单。','Append keeps existing items; replace keeps only this list.','追加は既存商品を保持し、置換は今回の一覧のみ残します。')}</p><div className="flex flex-wrap gap-3"><button disabled={busy} className="bg-blue-600 text-white p-3 rounded-xl" onClick={()=>void add('append')}>{label('保留原商品，追加','Append','追加')}</button><button disabled={busy} className="border border-red-300 text-red-600 p-3 rounded-xl" onClick={()=>void add('replace')}>{label('替换为本次清单','Replace','置換')}</button></div></div>:item&&(item.product.id==='p4'?<FrameQuoteEditor language={language} product={item.product} initialItem={item} onSave={save} saving={busy}/>:item.product.id==='p2'?<ProfileEditor language={language} product={item.product} user={user} initialItem={item} onSaveConfiguration={save} onCancelConfiguration={()=>setIndex(null)} saving={busy} onAddBatchToCart={()=>{}} onUpdateItem={()=>{}} draftProfiles={drafts} setDraftProfiles={setDrafts}/>:<BoardQuoteEditor language={language} product={item.product} user={user} initialItem={item} onSaveConfiguration={save} saving={busy} onAddToCart={()=>{}} onUpdateItem={()=>{}}/>)}
 </div></div>,document.body)}
 </div>;
}
