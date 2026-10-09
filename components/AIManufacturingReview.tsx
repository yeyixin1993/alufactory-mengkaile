import {useAIText} from '../utils/aiLocale';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ProfileEditor from './ProfileEditor';
import { ShoppingCart, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CartItem, ProfileConfig, ProfileSide, User } from '../types';
import { INITIAL_PRODUCTS } from '../constants';
import ProfileVisualizer from './ProfileVisualizer';
import { ApiService } from '../services/apiService';
const AIProfile3D = React.lazy(() => import('./AIProfile3D'));
function configuration(row:any, accessories:string):ProfileConfig {
  return {length:row.spec.length,variantId:row.spec.model,colorId:row.spec.color,
    finish:row.spec.color==='natural'?'oxidized':row.spec.section==='colored'?'powder':'electrophoretic',
    holes:row.holes,tapping:row.spec.tapping_ports || {left:[['left','both'].includes(row.spec.tapping)],right:[['right','both'].includes(row.spec.tapping)]},
    miterCut:row.miter_cut||undefined,unitPrice:row.unit_price,
    remark:row.spec.remark || (accessories==='self_purchase'?'AI加工已确认；配件由客户自行购买。':accessories==='later'?'AI加工已确认；本单仅型材，配件稍后另配。':'AI加工已确认；本单仅包含型材。')};
}
export default function AIManufacturingReview({review,requestId,visitorToken,onAdd,onEdited,user,cart=[],active=true}:{user?:User|null;onEdited?:(result:any)=>void;active?:boolean;review:any;requestId:string;visitorToken:string;cart?:CartItem[];onAdd?:(items:CartItem[],mode?:'append'|'replace')=>void;onReply?:(text:string)=>void}) {
 const {language,tr}=useAIText();
  const [index,setIndex]=useState(0), [side,setSide]=useState<ProfileSide>('A');
  const [checked,setChecked]=useState<number[]>([]), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const navigate=useNavigate();
  const [editing,setEditing]=useState(false);
  const [editorDrafts,setEditorDrafts]=useState<CartItem[]>([]);
  const [editError,setEditError]=useState('');
  const [saving,setSaving]=useState(false);
  const [chooseCart,setChooseCart]=useState(false);
  const dialogRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!chooseCart)return;
    const previous=document.activeElement as HTMLElement|null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setChooseCart(false);}
      if(event.key==='Tab'){
        const buttons=dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if(!buttons?.length)return;
        const first=buttons[0],last=buttons[buttons.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=previousOverflow;previous?.focus();};
  },[chooseCart]);
  const configs=useMemo(()=>review.items.map((row:any)=>configuration(row,review.accessories)),[review]);
  if(!configs.length)return null;
  const config=configs[index]||configs[0];
  const allChecked=checked.length===configs.length;
  const add=async(mode?:'append'|'replace')=>{
    if(cart.length&&!mode){setChooseCart(true);return;}
    setChooseCart(false);
    setBusy(true);setError('');
    try{
      const fresh=await ApiService.aiRequest('/quote',{request_id:requestId,visitor_token:visitorToken,for_cart:true,confirmed:true,profile_only:true});
      const rows=fresh.quote.items||[fresh.quote];
      if(rows.length!==review.items.length||rows.some((r:any,i:number)=>r.unit_price!==review.items[i].unit_price))throw new Error(tr("价格已更新，请在聊天中重新确认报价。"));
      const product=INITIAL_PRODUCTS.find(p=>p.id==='p2');if(!product||!onAdd)throw new Error(tr("购物车暂不可用"));
      onAdd(rows.map((r:any,i:number)=>({id:`ai-confirmed-${requestId}-${i}`,product,quantity:r.spec.quantity,totalPrice:r.subtotal,config:configuration(fresh.review.items[i],fresh.review.accessories)})),mode);
      navigate('/cart');
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  };
  return <div className="ai-machining-review">
    <div className="ai-review-visual-header"><label>{tr("型材")}<select aria-label={tr("查看清单项")} value={index} onChange={e=>{setIndex(Number(e.target.value));setSide('A');}}>{review.items.map((r:any,i:number)=><option key={i} value={i}>{i+1}. {r.spec.model} / {r.spec.length}mm × {r.spec.quantity}</option>)}</select></label><span>{checked.length}/{configs.length} {tr("已核对")}</span></div>
    <React.Suspense fallback={<p>{tr("加载立体图…")}</p>}><AIProfile3D config={config}/></React.Suspense>
    {active&&<div className="flex justify-end mb-2"><button type="button" disabled={busy} className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-600" onClick={()=>{setEditError('');setEditing(true);}}><Pencil size={15}/>{tr("编辑加工")}</button></div>}
    {editing&&createPortal(<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-2 sm:p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={tr("编辑型材加工")}>
      <div className="w-full max-w-4xl max-h-[92dvh] overflow-y-auto rounded-3xl bg-white p-2 sm:p-4">
        <p className="px-4 py-2 text-sm text-slate-500">{language==='cn'?`第 ${index+1} 项 · 本项 ${review.items[index].spec.quantity} 根同步修改；保存后重新计算报价。`:language==='en'?`Item ${index+1} · Changes apply to all ${review.items[index].spec.quantity} pieces. Saving recalculates the quote.`:`項目 ${index+1}・${review.items[index].spec.quantity} 本すべてに反映し、保存後に再見積りします。`}</p>
        {editError&&<p role="alert" className="px-4 py-2 text-red-600">{editError}</p>}
        <ProfileEditor language={language} product={INITIAL_PRODUCTS.find(p=>p.id==='p2')!} user={user} initialItem={{id:'ai-editor',product:INITIAL_PRODUCTS.find(p=>p.id==='p2')!,config,quantity:review.items[index].spec.quantity,totalPrice:review.items[index].subtotal}} draftProfiles={editorDrafts} setDraftProfiles={setEditorDrafts} onAddBatchToCart={()=>{}} onUpdateItem={()=>{}} saving={saving} onCancelConfiguration={()=>{if(!saving)setEditing(false);}} onSaveConfiguration={async item=>{
          setSaving(true);setEditError('');
          try{const result=await ApiService.aiRequest('/edit-profile',{request_id:requestId,visitor_token:visitorToken,source_index:review.items[index].source_index??index,revision:review.revision||0,config:item.config});onEdited?.(result);setChecked([]);setEditing(false);}
          catch(e:any){setEditError(e.message||tr("保存失败，请重试。"));}finally{setSaving(false);}
        }}/>
      </div>
    </div>,document.body)}
    <ProfileVisualizer config={config} selectedSide={side} onSideChange={setSide} tapLabel={tr("端面攻丝")} showSideSelector/>
    <details className="ai-machining-details"><summary>{tr("加工标注")}</summary>
      <p>{tr("左端攻丝")}{config.tapping.left.filter(Boolean).length} · {tr("右端攻丝")} {config.tapping.right.filter(Boolean).length}</p>
      {config.holes.map(h=><p key={h.id}>{h.side} · {language==='cn'?'距左端':language==='en'?'from left end':'左端から'} {h.positionMm}mm · {{through:tr("通孔"),countersunk:tr("沉头孔"),threaded:tr("螺纹孔")}[h.type]} {h.threadSize||''}</p>)}
      {config.miterCut&&<p>{tr("45°斜切")}: {(['left','right'] as const).filter(end=>config.miterCut?.[end].enabled).map(end=>`${end==='left'?tr("左端"):tr("右端")} ${config.miterCut![end].side} 面 ${config.miterCut![end].direction==='up'?tr("向上"):tr("向下")}`).join('；')}</p>}
      {!review.can_confirm&&!review.ready&&<p>{tr("未明确的孔位或斜切未画出，请在对话中补充。")}</p>}
    </details>
    {active?<div className="ai-review-confirmation">
      <label className="ai-quote-ack"><input type="checkbox" disabled={busy} checked={checked.includes(index)} onChange={e=>setChecked(prev=>e.target.checked?Array.from(new Set([...prev,index])):prev.filter(i=>i!==index))}/>{tr("确认本项配置")}</label>
      <label className="ai-quote-ack"><input type="checkbox" disabled={busy} checked={allChecked} onChange={e=>setChecked(e.target.checked?configs.map((_:any,i:number)=>i):[])}/>{tr("一键确认全部型材")}</label>
      <button className="ai-add-config" disabled={busy||!allChecked} onClick={()=>void add()}>{busy?tr("正在核对…"):tr("加入购物车")}</button>
      <small>{tr("本次仅加入型材，配件可自行购买或稍后另配。")}</small>
    </div>:<p className="ai-review-old">{tr("历史方案，请在最新回复中确认。")}</p>}
    {chooseCart&&createPortal(<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ai-cart-conflict-title" aria-describedby="ai-cart-conflict-description">
      <div ref={dialogRef} className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ShoppingCart className="h-6 w-6"/></div>
        <h2 id="ai-cart-conflict-title" className="mt-4 text-xl font-black text-slate-950">{tr("购物车已有商品")}</h2>
        <p id="ai-cart-conflict-description" className="mt-2 text-sm font-bold leading-relaxed text-slate-600">{tr("要在原购物车基础上添加本次清单，还是用本次清单覆盖原购物车？")}</p>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
          <p>{tr("原有商品")} ¥{cart.reduce((n,item)=>n+item.totalPrice,0).toFixed(2)}</p>
          <p>{tr("本次型材及加工")} ¥{review.items.reduce((n:number,item:any)=>n+item.unit_price*item.spec.quantity,0).toFixed(2)}</p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">{tr("追加保留原有商品及配件；覆盖只留下本次型材。运费在购物车按地址计算。")}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={()=>void add('append')} className="rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500">{tr("追加到购物车")}</button>
          <button type="button" disabled={busy} onClick={()=>void add('replace')} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-black text-red-600 transition hover:bg-red-100">{tr("覆盖原购物车")}</button>
          <button type="button" onClick={()=>setChooseCart(false)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 sm:col-span-2">{tr("取消")}</button>
        </div>
      </div>
    </div>,document.body)}
    {error&&<p role="alert" className="ai-confirm-error">{error}</p>}
  </div>;
}
