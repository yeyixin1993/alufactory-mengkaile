import React from 'react';
import { Link } from 'react-router-dom';
import { CartItem, Language, ProductType, User } from '../types';
import AccessoryQuoteEditor from './AccessoryQuoteEditor';
import FurnitureConfigurator from './FurnitureConfigurator';

export default function AIGuidanceCard({cards, language, user, onAdd}: {cards:any[]; language:Language; user:User|null; onAdd?:(items:CartItem[])=>void}) {
  const label=(cn:string,en:string,jp:string)=>language==='cn'?cn:language==='jp'?jp:en;
  return <div className="space-y-4 mt-4 whitespace-normal">{cards.map((card,index)=><div key={index} className="rounded-xl border border-slate-200 bg-white p-4">
    {card.kind==='section'&&<><img src={`/images/profile_${/^[\w-]+$/.test(card.model)?card.model:'2020'}.png`} alt={label('型材截面图','Profile cross-section','断面図')} className="max-h-80 mx-auto object-contain"/><Link to="/product/p2" className="text-blue-600">{label('选择其他型材 / 查看截面','Select a profile / cross-section','型材・断面を選択')}</Link></>}
    {card.kind==='accessories'&&<AccessoryQuoteEditor language={language} user={user} product={{id:'accessory',type:ProductType.ACCESSORY,name:{cn:'配件',en:'Accessories',jp:'パーツ'},description:{cn:'',en:'',jp:''},basePrice:0,imageUrl:'/images/accessory/accessory_codes.jpg'}} returnCartPath="/cart" onAddToCart={item=>onAdd?.([item])} onUpdateItem={()=>{}}/>}
    {card.kind==='wardrobe'&&<FurnitureConfigurator language={language} type={ProductType.WARDROBE} initialAdvice={card.defaults}/>}
    {card.kind==='alternatives'&&<div className="flex gap-6"><Link to="/product/p3" className="text-blue-600">{label('铝框门','Aluminum frame doors','アルミフレームドア')}</Link><Link to="/product/p6" className="text-blue-600">{label('海洋板','Marine board','マリンボード')}</Link></div>}
    {card.kind==='contact'&&<div className="flex items-center gap-4"><img src="/images/wechat-qr.jpg" alt={label('添加微信二维码','WeChat contact QR','WeChat QRコード')} className="w-28 h-28 object-contain"/><div>{label('加微信，沟通设计与选型','Contact us for design and selection','設計・選定のご相談')}<br/><strong>WeChat: 19821200413</strong></div></div>}
  </div>)}</div>;
}
