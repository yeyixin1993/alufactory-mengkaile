import {AILanguageContext,aiText} from '../utils/aiLocale';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ApiService } from '../services/apiService';
import { CartItem, User, Language } from '../types';
import { ArrowUp, Sparkles, ArrowUpRight, MessageSquare, Plus, ImagePlus, FileText, X, PanelLeft, BookOpen, Box, ShoppingBag, Home, MessageCircle } from 'lucide-react';
import './AIChatBar.css';
import { aiVisibility } from '../utils/aiVisibility';
import AIManufacturingReview from './AIManufacturingReview';
import AIQuoteCard from './AIQuoteCard';
import AIOrderConfirmation from './AIOrderConfirmation';
import AIResponseReveal from './AIResponseReveal';
import { saveChatDraft, takeChatDraft, ChatAttachment } from '../utils/aiChatHandoff';

const VISITOR_KEY = 'mengkaile-ai-visitor';
const visitor = () => { try { return localStorage.getItem(VISITOR_KEY) || ''; } catch { return ''; } };
const saveVisitor = (token: string) => { if (token) try { localStorage.setItem(VISITOR_KEY, token); } catch { /* server still limits new visitors */ } };
const money = (value: number) => value.toFixed(4);

// A refused connection arrives as a fetch TypeError, or as a 5xx when the dev proxy
// cannot reach the API. Those are the only cases where "cannot connect" is the truth;
// every other failure carries the backend's own reason — an expired visitor token, the
// daily cap on new visitor accounts, an exhausted trial — and saying "cannot connect"
// instead sends the reader hunting for a network problem that does not exist.
const CONNECTION_FAILURE = /failed to fetch|networkerror|load failed|connection (refused|closed)|api request failed \((500|502|503|504)\)/i;

// Why the advisor stopped serving this visitor. Signing in is the fix for every locked
// state except a stale visitor token, which a reload clears.
type AdvisorLock = '' | 'trial_exhausted' | 'guest_rate_limited' | 'visitor_token_stale';
const LOCK_BY_REASON: Record<string, AdvisorLock> = {
  trial_exhausted: 'trial_exhausted',
  guest_rate_limited: 'guest_rate_limited',
  visitor_token_invalid: 'visitor_token_stale',
  visitor_token_expired: 'visitor_token_stale',
};
const LOCKED = (lock: AdvisorLock) => !!lock && lock !== 'visitor_token_stale';

const statusFailure = (error: any): { message: string; lock: AdvisorLock } => {
  const message = String(error?.message || '').trim();
  // An expired session already redirects to /#/login inside the API client.
  if (/\(401\)$/.test(message)) return { message: '', lock: '' };
  if (!message || CONNECTION_FAILURE.test(message)) return { message: '咨询服务暂时连接不上，请稍后重试，或先使用快速报价。', lock: '' };
  return { message, lock: LOCK_BY_REASON[String(error?.payload?.reason || '')] || '' };
};

export default function AIChatBar({ user, onAddToCart, cart=[], language, onLanguageChange }: { language:Language;onLanguageChange:(language:Language)=>void; user: User | null; key?: string; cart?:CartItem[]; onAddToCart?: (items: CartItem[], mode?: 'append'|'replace') => void }) {
  const tr=(text:string)=>aiText(language,text);
  const location = useLocation();
  const home = location.pathname === '/';
  const aiHidden = useSyncExternalStore(aiVisibility.subscribe, aiVisibility.getSnapshot);
  useEffect(() => { if (home) aiVisibility.setHidden(false); }, [home, location.key]);
  const workspace = location.pathname === '/ai-chat';
  const handoffStarted = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const [sidebar, setSidebar] = useState(false);
  useEffect(()=>{setOpen(workspace);setSidebar(false);},[workspace]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState<any>(null);
  const [lock, setLock] = useState<AdvisorLock>('');
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<ChatAttachment[]>([]);
  const [uploadMenu,setUploadMenu]=useState(false);
  const [reading,setReading]=useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);
  const label=(cn:string,en:string,jp:string)=>language==='cn'?cn:language==='en'?en:jp;
  const chooseFiles = async (files:FileList|null) => {
    if (!files?.length) return;
    setUploadMenu(false);setReading(true);setError('');
    try {
      const selected=Array.from(files);
      if(attachment.length+selected.length>8) throw new Error(label('每条消息最多8个附件','Up to 8 attachments per message','1通につき添付は8件まで'));
      const added:ChatAttachment[]=[];
      for(const file of selected){
        const isImage=['image/jpeg','image/png','image/webp'].includes(file.type);
        if(!isImage&&!/\.(pdf|docx|xlsx|csv|txt)$/i.test(file.name)) throw new Error(label('支持 JPG/PNG/WebP、PDF、DOCX、XLSX、CSV、TXT','Supported: JPG/PNG/WebP, PDF, DOCX, XLSX, CSV, TXT','対応：JPG/PNG/WebP、PDF、DOCX、XLSX、CSV、TXT'));
        if(file.size>(isImage?4:10)*1024*1024) throw new Error(label('图片最大4MB，文件最大10MB','Images up to 4MB; files up to 10MB','画像は4MB、ファイルは10MBまで'));
        const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error(label('附件读取失败','Unable to read attachment','添付を読み込めません')));reader.readAsDataURL(file);});
        added.push({name:file.name,data,kind:isImage?'image':'file'});
      }
      const all=[...attachment,...added];
      if(all.reduce((sum,a)=>sum+(a.data.split(',')[1]?.length||0)*.75,0)>20*1024*1024) throw new Error(label('附件总大小最多20MB','Attachments must total 20MB or less','添付の合計は20MBまで'));
      setAttachment(all);setPending(null);
    } catch(e:any){setError(e.message);} finally {setReading(false);}
  };
  const freshReplies = useRef(new Set<string>());
  const [messages, setMessages] = useState<{ role: string; content: string; quote?: any; request_id?: string; image?: string | null; attachments?:ChatAttachment[]; review?: any; order_confirmed?:number[]; order_revision?:number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [recharge, setRecharge] = useState(false);
  const [amount, setAmount] = useState(10);
  const [customAmount, setCustomAmount] = useState(false);
  const [wechatPhone, setWechatPhone] = useState(user?.phone || '');
  const [wechatNote, setWechatNote] = useState('');
  const [wechatRecords, setWechatRecords] = useState<any[]>([]);
  const [wechatPage, setWechatPage] = useState(1);
  const [wechatPages, setWechatPages] = useState(1);
  const wechatOperation = useRef(crypto.randomUUID());
  useEffect(() => { setWechatPhone(user?.phone || ''); setWechatRecords([]); wechatOperation.current=crypto.randomUUID(); }, [user?.id, user?.phone]);
  useEffect(() => { if (recharge && user) void loadWechat(); }, [recharge, user?.id]);
  const loadWechat = async (page=1) => { try { const r = await ApiService.aiRequest('/wechat-applications?page='+page); setWechatRecords(r.records); setWechatPage(r.page); setWechatPages(r.pages); } catch (e:any) { setError(e.message); } };
  const submitWechat = async () => {
    setPaying(true); setError('');
    try {
      await ApiService.aiRequest('/wechat-applications', { operation_id:wechatOperation.current, amount_cny:amount, phone:wechatPhone, wechat_id:wechatNote });
      wechatOperation.current = crypto.randomUUID(); setWechatNote(''); await loadWechat();
    } catch(e:any) { setError(e.message); } finally { setPaying(false); }
  };
  const [paying, setPaying] = useState(false);
  const [entries, setEntries] = useState<any[] | null>(null);
  const [pending, setPending] = useState<{ id: string; text: string } | null>(null);
  const refresh = async () => {
    const data = await ApiService.aiRequest('/status', { visitor_token: visitor() });
    saveVisitor(data.visitor_token);
    setStatus(data);
    setMessages(data.history || []);
    setError('');
    setLock('');
    return data;
  };
  useEffect(() => {
    let active = true;
    setMessages([]); setAttachment([]); setInput(''); setStatus(null); setError(''); setLock(''); setPending(null); setEntries(null); setOpen(workspace);
    ApiService.aiRequest('/status', { visitor_token: visitor() }).then(data => {
      if (active) { saveVisitor(data.visitor_token); setStatus(data); setMessages(data.history || []); setLock(''); }
    }).catch((err: any) => { const failure = statusFailure(err); if (active) { setError(failure.message); setLock(failure.lock); } });
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => {
    const focus = () => { refresh().catch((err: any) => { const failure = statusFailure(err); setError(failure.message); setLock(failure.lock); }); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [user?.id]);
  const submit = async (text: string, picture: ChatAttachment[] | null, fixedId?: string, conversationId?:string) => {
    const id = fixedId || (pending?.text === text ? pending.id : crypto.randomUUID());
    setInput(text); setAttachment(picture || []); setPending({ id, text }); setBusy(true); setError(''); setOpen(true);
    try {
      const result = await ApiService.aiRequest('/chat', { message: text, request_id: id, visitor_token: visitor(), attachments: picture || [], conversation_id: conversationId || status?.conversation_id });
      saveVisitor(result.visitor_token);
      freshReplies.current.add(id);
      setMessages(previous => [...previous, { role: 'user', content: text, attachments: picture || [] }, { role: 'assistant', content: result.reply, quote: result.quote, request_id: id, review: result.review }]);
      setInput(''); setAttachment([]); setPending(null);
      await refresh();
    } catch (err: any) {
      setError(err.message || '发送失败，请重试。');
      const failure = statusFailure(err); if (failure.lock) setLock(failure.lock);
    }
    finally { setBusy(false); }
  };
  useEffect(() => { if (workspace) endRef.current?.scrollIntoView({behavior:'auto',block:'end'}); }, [messages, busy]);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('draft');
    if (!workspace || !status || !id || handoffStarted.current || (ApiService.isAuthenticated() && !user)) return;
    handoffStarted.current = true;
    takeChatDraft(id).then(async draft => {
      if (!draft) throw new Error('这条待发送消息已接收或过期，请直接输入新需求。');
      if (draft.owner !== (user?.id || 'guest')) throw new Error('登录账号已变化，请重新发送需求。');
      window.history.replaceState(null, '', '#/ai-chat');
      const attachments=draft.attachments || (draft.image?[{name:"图片",data:draft.image,kind:'image' as const}]:[]);
      setInput(draft.text); setAttachment(attachments);
      let conversationId=status.conversation_id;
      if(draft.newConversation){
        setBusy(true);
        try {
          const created=await ApiService.aiRequest('/reset',{visitor_token:visitor()});
          conversationId=created.conversation_id;
          setMessages([]);
        } catch(e){setBusy(false);throw e;}
      }
      return submit(draft.text, attachments, id, conversationId);
    }).catch(e => setError(e.message));
  }, [workspace, status, user?.id]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || reading || (!input.trim() && !attachment.length)) return;
    const text = input.trim() || label('请读取这些附件中的需求，列出需要确认或补充的信息。','Read these attachments and ask about any missing or unclear requirements.','添付の要望を読み取り、不明点を質問してください。');
    if (workspace) { await submit(text, attachment); return; }
    const tab = window.open('about:blank', '_blank');
    if (!tab) { setError('浏览器拦截了新窗口，请允许弹出窗口后重新发送。'); return; }
    tab.opener = null;
    setBusy(true); setError('');
    try {
      const id = crypto.randomUUID();
      await saveChatDraft(id, {text, attachments: attachment, newConversation:true, owner:user?.id || 'guest', created:Date.now()});
      tab.location.href = `${window.location.origin}${window.location.pathname}#/ai-chat?draft=${id}`;
      setInput(''); setAttachment([]);
    } catch(e:any) { tab.close(); setError(e.message || '新窗口打开失败，消息尚未发送。'); }
    finally { setBusy(false); }
  };
  const newChat = async () => {
    setBusy(true);
    try { await ApiService.aiRequest('/reset', {visitor_token:visitor()}); setMessages([]); setInput(''); setAttachment([]); setPending(null); await refresh(); setSidebar(false); }
    catch(e:any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const openConversation = async (id:string) => {
    if (busy || id === status?.conversation_id) return;
    setBusy(true); setError('');
    try {
      const data = await ApiService.aiRequest('/conversations/open', {visitor_token:visitor(), conversation_id:id});
      saveVisitor(data.visitor_token); setStatus(data); setMessages(data.history || []);
      setInput(''); setAttachment([]); setPending(null); freshReplies.current.clear(); setSidebar(false);
    } catch(e:any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const pay = async () => {
    setPaying(true); setError('');
    try {
      const result = await ApiService.aiRequest('/recharge', { amount_cny: amount, operation_id: crypto.randomUUID() });
      const url = new URL(result.pay_url);
      if (url.protocol !== 'https:') throw new Error('付款地址无效。');
      window.location.assign(url.href);
    } catch (err: any) { setError(err.message); }
    finally { setPaying(false); }
  };
  // A visitor always sees how much of the device allowance is left (3/3 → 0/3). The count is
  // per device and does not expire, so 0/3 simply means "this browser has spent its three";
  // the composer then stops accepting messages and offers signing in instead of a dead button.
  const trialRemaining = status?.trial_mode ? Math.max(0, Number(status.trial_remaining) || 0) : null;
  const trialLimit = Number(status?.trial_limit) > 0 ? Number(status.trial_limit) : 3;
  const trialExhausted = trialRemaining !== null && trialRemaining <= 0;
  const lockKind: AdvisorLock = lock || (trialExhausted ? 'trial_exhausted' : '');
  const needsLogin = !user && LOCKED(lockKind);
  const quotaText = status
    ? trialRemaining !== null
      ? label(
          trialExhausted ? `${user ? '试用额度' : '游客试用'}已用完（${trialRemaining}/${trialLimit}）` : `剩余 ${trialRemaining}/${trialLimit} 条免费消息`,
          trialExhausted ? `${user ? 'Trial' : 'Guest trial'} used up (${trialRemaining}/${trialLimit})` : `${trialRemaining}/${trialLimit} free messages left`,
          trialExhausted ? `${user ? '試用' : 'ゲスト試用'}を使い切りました（${trialRemaining}/${trialLimit}）` : `無料メッセージ残り ${trialRemaining}/${trialLimit} 通`)
      : `${label('AI 余额','AI balance','AI 残高')} ¥${money(status.balance_cny)}`
    : lock === 'guest_rate_limited'
      ? label('本机今日试用名额已满','No guest trial left on this network','この回線の試用枠は使い切りました')
      : error ? tr('额度暂不可用') : tr('正在读取额度…');
  // Only a visitor can be asked to sign in. A signed-in account with a spent trial has its
  // own recharge entry in the header, so it must not be told to sign in again.
  const lockNotice = needsLogin
    ? label(
        lockKind === 'guest_rate_limited' ? '本机今日的游客试用名额已满，登录后可继续。' : '游客试用已用完，登录后可继续。',
        lockKind === 'guest_rate_limited' ? 'No guest trial left on this network. Sign in to continue.' : 'Your guest trial is used up. Sign in to continue.',
        lockKind === 'guest_rate_limited' ? 'この回線のゲスト試用枠は使い切りました。ログインで続行できます。' : 'ゲスト試用を使い切りました。ログインで続行できます。')
    : '';
  return <AILanguageContext.Provider value={language}>
    {aiHidden && !home && <div className={`ai-restore-bar ${workspace?'ai-restore-workspace':''}`}><button type="button" className="ai-visibility-button" onClick={()=>aiVisibility.setHidden(false)}><Sparkles size={17}/>{label('显示 AI 顾问','Show AI advisor','AIアドバイザーを表示')}</button>{workspace&&<Link to="/">{label('返回首页','Back to home','ホームへ')}</Link>}</div>}
    <section hidden={aiHidden && !home} className={`ai-entry ${workspace ? 'ai-chat-workspace' : home ? 'ai-entry-home' : 'ai-entry-compact'}`} aria-label={tr("AI 设计与咨询")}>
    {workspace && <>
      {sidebar&&<button className="ai-sidebar-scrim" aria-label={tr("关闭咨询导航")} onClick={()=>setSidebar(false)}/>}
      <aside className={`ai-chat-sidebar ${sidebar?'is-open':''}`}>
        <div className="ai-sidebar-heading"><Link to="/" className="ai-chat-brand"><span className="ai-brand-mark">M</span>萌开了</Link><button className="ai-sidebar-close" aria-label={tr("关闭侧栏")} onClick={()=>setSidebar(false)}><PanelLeft size={19}/></button></div>
        <button className="ai-new-chat" disabled={busy} onClick={newChat}><Plus size={18}/>{tr("新对话")}</button>
        <p className="ai-sidebar-label">{language==='cn'?'历史对话':language==='en'?'Chat history':'チャット履歴'}</p>
        <div className="ai-history-list">
          {(status?.conversations || []).map((conversation:any)=><button key={conversation.id} disabled={busy} className={`ai-current-chat ${conversation.id===status?.conversation_id?'is-selected':''}`} aria-current={conversation.id===status?.conversation_id?'page':undefined} title={conversation.title} onClick={()=>void openConversation(conversation.id)}><MessageCircle size={16}/><span>{conversation.title==='新对话'?tr('新对话'):conversation.title}</span></button>)}
        </div>
        <div className="ai-sidebar-links"><Link to="/catalog" target="_blank" rel="noopener noreferrer"><BookOpen size={17}/>{tr("价格画册")}</Link><Link to="/diy-designer" target="_blank"><Box size={17}/>{tr("3D 设计器")}</Link><Link to="/cart"><ShoppingBag size={17}/>{tr("购物车")}</Link><Link to="/"><Home size={17}/>{tr("返回首页")}</Link></div>
        <Link to={user?'/history':'/login'} className="ai-sidebar-user"><span>{user?'M':tr("访")}</span>{user?tr("我的账户"):tr("登录 / 注册")}</Link>
      </aside>
    </>}
    {home && <header className="ai-entry-heading">
      <span className="ai-entry-eyebrow"><Sparkles size={14} /> {tr("萌开了 · AI 设计顾问")}</span>
      <h1>{tr("你的想法，")}<span>{tr("从这里开始。")}</span></h1>
      <p>{tr("聊聊你想做什么。选型、加工、报价，一起把需求说清楚。")}</p>
    </header>}
    <div className="ai-entry-card">
      <div className="ai-entry-toolbar">
        {(home || workspace) ? <select className="ai-language-select" aria-label="Language" value={language} onChange={e=>onLanguageChange(e.target.value as Language)}><option value="cn">中文</option><option value="en">English</option><option value="jp">日本語</option></select> : <button type="button" className="ai-visibility-button" onClick={()=>{aiVisibility.setHidden(true);setSidebar(false);}} title={label('隐藏后全站生效，返回首页自动恢复','Hide across the site; returning home restores it','サイト全体で非表示。ホームに戻ると再表示')}><X size={15}/>{label('隐藏 AI','Hide AI','AIを非表示')}</button>}
        {workspace&&<button className="ai-sidebar-toggle" aria-label={tr("打开咨询导航")} onClick={()=>setSidebar(!sidebar)}><PanelLeft size={20}/></button>}
        <button className="ai-entry-history" onClick={() => { if (!workspace) setOpen(!open); }} aria-expanded={open}><MessageSquare size={15} /> {home ? tr("咨询记录") : tr("AI 设计顾问")} {!workspace&&(open ? '▴' : '▾')}</button>
        <div className="ai-entry-account">
          {workspace && <button type="button" className="ai-visibility-button" onClick={()=>{aiVisibility.setHidden(true);setSidebar(false);}} title={label('隐藏后全站生效，返回首页自动恢复','Hide across the site; returning home restores it','サイト全体で非表示。ホームに戻ると再表示')}><X size={15}/>{label('隐藏 AI','Hide AI','AIを非表示')}</button>}
          <span aria-live="polite">{quotaText}</span>
          <button className="text-blue-700 underline" onClick={() => setRecharge(!recharge)}>{tr("充值")}</button>
          {user && <button className="underline" onClick={async () => { try { const data = await ApiService.aiRequest('/ledger'); setEntries(data.entries); } catch (e: any) { setError(e.message); } }}>{tr("收支记录")}</button>}
          <button className="underline" onClick={() => refresh().catch(err => setError(err.message))}>{tr("刷新余额")}</button>
        </div>
      </div>
      {(open || workspace) && <div id="ai-conversation" className={workspace ? "ai-conversation" : "max-h-80 overflow-y-auto space-y-3 mb-3"} role="log" aria-label={tr("咨询记录")}>
        {!messages.length && <p className="ai-chat-welcome">{tr("想做点什么？可以直接发清单或图片，我们一起确认规格和加工。")}</p>}
        {messages.map((message, i) => <div key={i} className={`ai-chat-message ai-chat-message-${message.role} rounded-xl p-3 text-sm whitespace-pre-wrap ${message.role === 'user' ? 'bg-blue-50 ml-8' : 'bg-slate-50 mr-8'}`}><strong>{message.role === 'user' ? tr("你") : tr("AI 顾问")}</strong>{message.image&&<img className="ai-message-image" src={message.image} alt={tr("本条需求附图")}/>}{!!message.attachments?.length&&<div className="ai-attachments">{message.attachments.map((a,n)=>a.kind==='image'?<a key={n} href={a.data} download={a.name}><img className="ai-message-image" src={a.data} alt={a.name}/></a>:<a key={n} className="ai-attachment-chip" href={a.data} download={a.name}><FileText size={20}/><span>{a.name}</span></a>)}</div>}<AIResponseReveal text={[message.quote?message.content.split('\n')[0]:message.content, ...(message.review?.blocking_questions || []).slice(0,2)].filter(Boolean).join('\n\n')} animate={message.role==='assistant' && !!message.request_id && freshReplies.current.has(message.request_id)}>{message.quote&&message.request_id&&<AIQuoteCard quote={message.quote} canContinue={i===messages.length-1&&!busy&&(!message.review||!message.review.order_review)} requestId={message.request_id} visitorToken={visitor()} onReview={()=>{if(!busy) void submit('价格可以，请帮我确认打孔、攻丝和配件等下单配置。',null);}}/>}{message.quote?.items?.some((r:any)=>r.spec.product&&r.spec.product!=='profile')&&message.request_id&&<AIOrderConfirmation message={message} active={i===messages.length-1&&!busy} user={user} cart={cart} onAdd={onAddToCart} visitorToken={visitor()} onEdited={result=>setMessages(previous=>previous.map((m,n)=>n===i?{...m,content:result.reply,...result}:m))}/>}{message.review&&message.request_id&&<AIManufacturingReview review={message.review} active={i===messages.length-1&&!busy} requestId={message.request_id} visitorToken={visitor()} onReply={text=>{if(!busy) void submit(text,null);}} user={user} onEdited={result=>setMessages(previous=>previous.map((m,n)=>n===i?{...m,content:result.reply,quote:result.quote,review:result.review}:m))} cart={cart} onAdd={onAddToCart}/>}</AIResponseReveal></div>)}
        {busy&&<p className="ai-chat-thinking" role="status">{tr("正在整理你的需求…")}</p>}
        <div ref={endRef}/>
        {!workspace&&<button disabled={busy} className="text-xs underline" onClick={newChat}>{tr("开始新咨询（不重置额度）")}</button>}
      </div>}
      {workspace && status?.needs_confirmation && <button type="button" disabled={busy || reading || !!attachment.length} className="ai-image-confirm" onClick={() => { setInput(tr("确认以上识别信息")); inputRef.current?.focus(); }}>{tr("确认识别信息（填入后发送）")}</button>}
      <form onSubmit={send} className="ai-entry-form">
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={e => { void chooseFiles(e.target.files); e.target.value = ''; }} />
        <input ref={documentRef} type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.txt" hidden onChange={e => { void chooseFiles(e.target.files); e.target.value = ''; }} />
        {!!attachment.length && <div className="ai-attachments">{attachment.map((a,i)=><div key={i} className="ai-attachment-chip">{a.kind==='image'?<img src={a.data} alt={a.name}/>:<FileText size={24}/>}<span title={a.name}>{a.name}</span><button type="button" disabled={busy||reading} aria-label={label('移除 ','Remove ','削除 ')+a.name} onClick={()=>{setAttachment(previous=>previous.filter((_,n)=>n!==i));setPending(null);}}><X size={16}/></button></div>)}</div>}
        <label htmlFor="ai-design-request" className="sr-only">{tr("描述你的设计或型材需求")}</label>
        <textarea id="ai-design-request" ref={inputRef} enterKeyHint="send" maxLength={2000} rows={2} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder={tr("想做点什么？例如：2020 粉色型材，1000mm，两端攻丝…")} />
        <div className="ai-entry-form-footer">
          <div className="ai-upload-control" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setUploadMenu(false);}} onKeyDown={e=>{if(e.key==='Escape')setUploadMenu(false);}}>
            <button type="button" className="ai-upload-plus" disabled={busy||reading} aria-label={label('添加图片或文件','Add images or files','画像・ファイルを追加')} aria-expanded={uploadMenu} aria-haspopup="menu" onClick={()=>setUploadMenu(!uploadMenu)}><Plus size={23}/></button>
            {uploadMenu&&<div className="ai-upload-menu" role="menu"><button type="button" role="menuitem" disabled={!status?.vision_enabled} onClick={()=>fileRef.current?.click()}><ImagePlus size={18}/>{label('图片','Images','画像')}</button><button type="button" role="menuitem" onClick={()=>documentRef.current?.click()}><FileText size={18}/>{label('文件','Files','ファイル')}</button><small>PDF · DOCX · XLSX · CSV · TXT</small><small>{label("最多8个附件，合计20MB", "Up to 8 attachments, 20MB total", "添付8件・合計20MBまで")}</small></div>}
            {reading&&<span role="status">{label('读取附件…','Reading…','読み込み中…')}</span>}
          </div>
          <div className="ai-entry-actions">
            <button aria-label={busy ? tr("正在处理") : tr("发送需求")} disabled={busy || reading || trialExhausted || !status?.enabled || (!status?.configured && !status?.local_answers_available) || (!input.trim() && !attachment.length)} className="ai-entry-send">{busy ? <span className="ai-entry-loading">···</span> : <><span>{tr("开始咨询")}</span><ArrowUp size={19} /></>}</button>
            {needsLogin && <Link to="/login" className="ai-entry-login">{tr("登录")}</Link>}
          </div>
        </div>
      </form>
      {home && !messages.length && <div className="ai-entry-suggestions" aria-label="试试这些问题">
        {['报价需要提供什么信息', '截面本色/彩色是什么意思', '能做和图片一样的吗'].map(example => <button key={example} onClick={() => { setInput(example); inputRef.current?.focus(); }}><Plus size={13} />{example}</button>)}
      </div>}
      <div className="ai-entry-notices">
      <p className="text-xs text-slate-500 mb-3">{tr("游客每台设备免费发送 3 条消息，回复追问也计入次数。登录后使用账户额度，VIP/VIP+ 含赠送额度。")}</p>
      {lockNotice && <p className="ai-entry-lock mb-3">{lockNotice} <Link to="/login" className="underline">{tr("登录")}</Link></p>}
      {status && (!status.enabled || (!status.configured && !status.local_answers_available)) && <p className="text-sm text-amber-800 mb-3">AI 咨询暂未开通，您可以先使用<Link to="/quick-quote" className="underline">{tr("快速报价")}</Link>。</p>}
      {status?.enabled && !status.configured && status.local_answers_available && <p className="text-sm text-slate-600 mb-3">目前可回答已收录的常见问题；智能规格识别暂未开通，估价请使用<Link to="/quick-quote" className="underline">{tr("快速报价")}</Link>。</p>}
      </div>
      {error && <p className="text-sm text-red-700 mt-3" role="alert">{error}</p>}
      {recharge && <div className="mt-4 border-t pt-4 text-sm space-y-3">
        <div className="flex items-center justify-between gap-3"><p className="font-bold">{tr("AI 额度充值 · 充多少到账多少")}</p><button type="button" className="ai-visibility-button" onClick={()=>setRecharge(false)}><X size={15}/>{label('关闭充值','Close recharge','チャージを閉じる')}</button></div>
        {!user ? <p>{tr("请先")}<Link to="/login" className="text-blue-700 underline">{tr("登录")}</Link>{tr("，方便将充值额度记入您的账号。")}</p> : <>
          <div className="flex flex-wrap gap-2" aria-label={tr("充值金额")}>{[10,20,50,100,300,500].map(n=><button type="button" key={n} disabled={paying} aria-pressed={!customAmount&&amount===n} onClick={()=>{setCustomAmount(false);setAmount(n);}} className={`rounded-xl px-5 py-3 border ${!customAmount&&amount===n?'bg-blue-600 text-white border-blue-600':'bg-slate-100 text-slate-700 border-slate-200'}`}>¥{n}</button>)}<button type="button" disabled={paying} aria-pressed={customAmount} onClick={()=>setCustomAmount(true)} className={`rounded-xl px-5 py-3 border ${customAmount?'bg-blue-600 text-white':'bg-slate-100 text-slate-700'}`}>{label('自定义','Custom','カスタム')}</button></div>
          {customAmount&&<label className="block">{label('充值金额（元）','Amount (CNY)','金額（人民元）')}<input type="number" min="1" max="100000" step="0.01" value={amount||''} onChange={e=>setAmount(Number(e.target.value))} className="border rounded-lg p-2 ml-2"/></label>}
          <button disabled={paying||amount<1||amount>100000} onClick={pay} className="rounded-lg bg-blue-600 text-white p-2">{paying ? tr("正在创建付款…") : tr("支付宝充值")}</button>
          <p>{tr("支付宝确认支付成功后自动到账。微信扫码付款由管理员核实后手动增加额度。")}</p>
          {status?.wechat_qr && <img src={status.wechat_qr} alt={tr("微信收款码")} className="w-44 h-44 object-contain border" />}
          <p>{label('微信付款后提交以下申请，客服核实后到账。额度记入当前登录账号。','Submit after paying by WeChat. Credits go to this signed-in account after verification.','WeChatで支払い後、申請してください。確認後、ログイン中のアカウントに反映されます。')}</p>
          <div className="flex flex-col gap-2 max-w-xl"><label>{label('联系手机号','Contact phone','連絡先電話番号')}<input className="block w-full border rounded-lg p-2" type="tel" value={wechatPhone} onChange={e=>setWechatPhone(e.target.value)} maxLength={30}/></label><label>{label('微信号（选填）','WeChat ID (optional)','WeChat ID（任意）')}<input className="block w-full border rounded-lg p-2" value={wechatNote} onChange={e=>setWechatNote(e.target.value)} maxLength={100}/></label><button type="button" disabled={paying||!wechatPhone.trim()||amount<1||amount>100000} onClick={submitWechat} className="rounded-lg bg-blue-600 text-white p-3 disabled:opacity-50">{label('提交微信充值申请','Submit WeChat payment','WeChat入金を申請')} · ¥{amount}</button></div>
          <button type="button" onClick={()=>loadWechat()} className="text-blue-600 underline">{label('充值申请历史 · 刷新','Recharge history · Refresh','入金申請履歴・更新')}</button>
          {wechatRecords.map(r=><p key={r.id}>¥{r.amount_cny.toFixed(2)} · {r.status==='pending'?label('待审核','Pending review','確認待ち'):r.status==='credited'?label('已到账','Credited','入金済み'):label('已拒绝','Rejected','却下')} · {new Date(r.created_at).toLocaleString()} · {r.phone}{r.wechat_id ? ` · ${r.wechat_id}` : ''} {r.review_note||''}</p>)}
          {!wechatRecords.length&&<p>{label('暂无充值申请','No recharge applications yet','申請履歴はありません')}</p>}
          {wechatPages>1&&<div className="flex gap-3"><button disabled={wechatPage<=1} onClick={()=>loadWechat(wechatPage-1)}>{label('上一页','Previous','前へ')}</button><span>{wechatPage} / {wechatPages}</span><button disabled={wechatPage>=wechatPages} onClick={()=>loadWechat(wechatPage+1)}>{label('下一页','Next','次へ')}</button></div>}
        </>}
      </div>}
      {entries && <div className="mt-4 border-t pt-3 text-xs"><div className="flex items-center justify-between gap-3"><p className="font-bold">{tr("收支记录")}</p><button type="button" className="ai-visibility-button" onClick={() => setEntries(null)}><X size={15}/>{tr("关闭收支记录")}</button></div>{!entries.length && <p>{tr("暂无记录。")}</p>}{entries.map((entry, i) => <p key={i} className="mt-2">{new Date(entry.created_at).toLocaleString()} · {({ grant: tr("赠送"), usage: tr("使用"), trial: tr("试用"), faq: tr("常见问答（免费）"), manual: tr("人工调整"), recharge: tr("充值") } as Record<string, string>)[entry.kind] || entry.kind} · {entry.amount_cny >= 0 ? '+' : ''}¥{money(entry.amount_cny)}</p>)}</div>}
    </div>
    {home && <div className="ai-entry-shortcuts"><span>也可以直接</span><Link to="/quick-quote">{tr("快速报价")}<ArrowUpRight size={14} /></Link><Link to="/diy-designer">打开 3D 设计器 <ArrowUpRight size={14} /></Link><button onClick={() => document.getElementById('profile-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>浏览商品 <ArrowUpRight size={14} /></button></div>}
  </section></AILanguageContext.Provider>;
}
