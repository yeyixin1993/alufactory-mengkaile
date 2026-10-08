import {useAIText} from '../utils/aiLocale';
import React from 'react';
import { PROFILE_COLORS, SHIPPING_METHOD_NAMES, getMarineBoardOrderColorName } from '../constants';
import QuickQuoteProfileDetails from './QuickQuoteProfileDetails';
import { calculateQuickProfileRow, QuickProfileRow } from '../utils/quickQuoteProfile';
const currency = (v:number) => `¥${Number(v).toFixed(2)}`;
export default function AIQuoteCard({quote,requestId,visitorToken,onReview,canContinue=true}:{canContinue?:boolean;quote:any;requestId:string;visitorToken:string;onReview?:()=>void}) {
 const {language,tr}=useAIText();
  const rows=quote.items||[quote];
  const color=(id:string)=>(PROFILE_COLORS.find(c=>c.id===id)?.name as any)?.[language]||id;
  const discount=quote.membership==='vip'?2:quote.membership==='vip_plus'?4:0;
  const materialRows=rows.filter((r:any)=>r.spec.product && r.spec.product!=='profile');
  const calculated=rows.filter((r:any)=>!r.spec.product || r.spec.product==='profile').map((r:any,index:number)=>{
    const s=r.spec;
    const row:QuickProfileRow={id:String(index),model:s.model,colorId:s.color,section:s.color==='natural'?'natural':s.section,length:s.length,quantity:s.quantity,
      tappingCount:s.tapping_ports ? [...s.tapping_ports.left,...s.tapping_ports.right].filter(Boolean).length : ({none:0,left:1,right:1,both:2} as Record<string,number>)[s.tapping]||0,
      throughHoleCount:s.through_hole_count||0,countersunkHoleCount:s.countersunk_count||0,threadedHoleCount:s.threaded_hole_count||0,miter45CutCount:s.miter45_count||0};
    return calculateQuickProfileRow(row,discount);
  });
  const grouped=new Map<string,number>();
  const process={tapping:0,through:0,countersunk:0,threaded:0,miter45:0};
  const details=calculated.map(({row}:any)=>{
    const name=`${row.model} · ${color(row.colorId)}`;grouped.set(name,(grouped.get(name)||0)+row.length*row.quantity/1000);
    process.tapping+=row.tappingCount*row.quantity;process.through+=row.throughHoleCount*row.quantity;process.countersunk+=row.countersunkHoleCount*row.quantity;process.threaded+=row.threadedHoleCount*row.quantity;process.miter45+=row.miter45CutCount*row.quantity;
    const counts=[[tr("端面攻丝"),row.tappingCount],[tr("通孔"),row.throughHoleCount],[tr("沉头孔"),row.countersunkHoleCount],[tr("螺纹孔"),row.threadedHoleCount],[tr("45°斜切"),row.miter45CutCount]].filter(x=>Number(x[1])>0).map(x=>`${x[0]}:${x[1]}`).join(' · ');
    return {id:row.id,text:`${name} · ${row.section==='natural'?tr("本色截面"):tr("彩色截面")} · ${row.length}mm × ${row.quantity}${counts?' · '+(language==='cn'?'每根':language==='en'?'per piece ':'1本あたり ')+counts:''}`};
  });
  return <div className="ai-quote-card"><div className="ai-quote-sheet">
    <div data-pdf-block><h3>{quote.partial?tr("部分清单估价"):tr("快速报价")}{quote.recognition_pending?tr(" · 图片待核对"):''}</h3><p>{quote.membership==='vip'?tr("VIP 价"):quote.membership==='vip_plus'?tr("VIP+ 价"):tr("普通售价")} · {materialRows.length?(language==='cn'?'材料及已注明加工':language==='en'?'Materials and specified processing':'材料・指定加工'):tr('铝型材材料及加工')} {currency(quote.subtotal)}</p></div>
    <div data-pdf-block className="ai-quote-shipping">{quote.free_shipping ? (language==='cn'?'包邮':language==='en'?'Shipping included':'送料無料') : quote.shipping_pending ? tr("运费待定 · 当前金额不含运费，可稍后在购物车填写地址计算。") : <>{tr("发往")}{rows[0]?.spec.province} · {(SHIPPING_METHOD_NAMES as any)[quote.shipping_method]?.[language]||quote.shipping_method} · {tr("预估重量")} {Number(quote.weight_kg).toFixed(1)}kg · {tr("运费")} {currency(quote.shipping_fee)}</>}</div>
    <div data-pdf-block className="ai-quote-total"><strong>{quote.partial?tr("已计价部分"):quote.shipping_pending?tr("材料及已知加工"):tr("预估合计")} {currency(quote.total)}</strong><p>{tr("这是暂估，不是生产订单。未明确的项目、加工和配件未包含，待确认内容见下方。")}</p></div>
    <div className="ai-quick-details"><h4 data-pdf-block>{tr("详情清单")}</h4>{calculated.length>0&&<QuickQuoteProfileDetails language={language} meters={Array.from(grouped,([name,meters])=>({name,meters}))} process={process} details={details}/>}
      {materialRows.map((r:any,i:number)=>{
        const s=r.spec;
        const names:Record<string,string[]>={aluminum_plate:['铝板','Aluminum plate','アルミ板'],pegboard:['洞洞板','Pegboard','ペグボード'],marine_board:['海洋板','Marine board','マリンボード'],frame:['相框','Picture frame','額縁'],cabinet_door:['铝框门','Aluminum frame door','アルミフレームドア'],accessory:['配件','Accessory','部品']};
        const langIndex=language==='cn'?0:language==='en'?1:2;
        const name=s.names?.[language]||names[s.product]?.[langIndex]||s.product;
        const subtype=s.product==='marine_board'?(s.marine_spec==='marine_bbb_plain'?['BBB素板','BBB plain','BBB素板']:['BBB两面UV清漆+覆膜','BBB double-side UV + film','BBB両面UV+フィルム'])[langIndex]:s.product==='frame'?({wood:['木框','Wood','木製'],aluminum:['铝框','Aluminum','アルミ'],alu_wood:['铝木框','Aluminum/wood','アルミ・木製']} as any)[s.frame_type]?.[langIndex]:'';
        return <div key={i} className="py-3 border-b border-slate-100 text-sm">
          <p>{name}{subtype?' · '+subtype:''}{s.color?' · '+(s.product==='marine_board'?getMarineBoardOrderColorName(s.color,language):color(s.color)):''} · {s.product==='accessory'?(s.length?`${s.length}mm · `:''):s.product==='frame'?`${s.inner_width}×${s.inner_height}mm · `:`${s.width}×${s.height}×${s.thickness}mm · `}× {s.quantity}</p>
          {r.area_sqm!==undefined&&<p>{['实际面积','Actual area','実面積'][langIndex]} {(r.area_sqm*s.quantity).toFixed(3)}㎡{r.min_area_applied?` · ${['每张最低计费','Minimum per piece','1枚の最低課金面積'][langIndex]} ${r.charged_area_sqm}㎡`:''}</p>}
          {r.hinge_count&&<p>{['每扇铰链','Hinges per door','1枚あたりヒンジ'][langIndex]} × {r.hinge_count} · {['已计入','Included','料金に含む'][langIndex]}</p>}
          <p>{['小计','Subtotal','小計'][langIndex]} {currency(r.subtotal)}{r.free_shipping?` · ${['包邮','Shipping included','送料無料'][langIndex]}`:''}</p>
        </div>;
      })}</div>
    {!!quote.pending_items?.length&&<div data-pdf-block><h4>{tr("尚未计价（不包含在上方金额中）")}</h4>{quote.pending_items.map((p:any)=><p key={p.index}>{language==='cn'?'第':language==='en'?'Item ':'項目 '}{p.index+1}: {p.spec.model||tr("型号待确认")} · {p.spec.length??'?'}mm × {p.spec.quantity??'?'} — {p.question}</p>)}</div>}
    {!!quote.questions?.length&&<div data-pdf-block><h4>{tr("继续确认")}</h4><ul>{quote.questions.map((q:string,i:number)=><li key={i}>{q}</li>)}</ul></div>}
    </div>
  </div>;
}
