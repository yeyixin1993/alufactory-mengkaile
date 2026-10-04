import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ApiService } from '../services/apiService';
import { User } from '../types';
import { ArrowUp, Sparkles, ArrowUpRight, MessageSquare, Plus } from 'lucide-react';
import './AIChatBar.css';

const VISITOR_KEY = 'mengkaile-ai-visitor';
const visitor = () => { try { return localStorage.getItem(VISITOR_KEY) || ''; } catch { return ''; } };
const saveVisitor = (token: string) => { if (token) try { localStorage.setItem(VISITOR_KEY, token); } catch { /* server still limits new visitors */ } };
const money = (value: number) => value.toFixed(4);

export default function AIChatBar({ user }: { user: User | null; key?: string }) {
  const home = useLocation().pathname === '/';
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState<any>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [recharge, setRecharge] = useState(false);
  const [amount, setAmount] = useState(10);
  const [paying, setPaying] = useState(false);
  const [entries, setEntries] = useState<any[] | null>(null);
  const [pending, setPending] = useState<{ id: string; text: string } | null>(null);
  const refresh = async () => {
    const data = await ApiService.aiRequest('/status', { visitor_token: visitor() });
    saveVisitor(data.visitor_token);
    setStatus(data);
    setError('');
    return data;
  };
  useEffect(() => {
    let active = true;
    setMessages([]); setStatus(null); setError(''); setPending(null); setEntries(null); setOpen(false);
    ApiService.aiRequest('/status', { visitor_token: visitor() }).then(data => {
      if (active) { saveVisitor(data.visitor_token); setStatus(data); setMessages(data.history || []); }
    }).catch(() => { if (active) setError('咨询服务暂时连接不上，请稍后重试，或先使用快速报价。'); });
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => {
    const focus = () => { refresh().catch(() => {}); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [user?.id]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !input.trim()) return;
    const text = input.trim();
    const id = pending?.text === text ? pending.id : crypto.randomUUID();
    setPending({ id, text }); setBusy(true); setError(''); setOpen(true);
    try {
      const result = await ApiService.aiRequest('/chat', { message: text, request_id: id, visitor_token: visitor() });
      saveVisitor(result.visitor_token);
      setMessages(previous => [...previous, { role: 'user', content: text }, { role: 'assistant', content: result.reply }]);
      setInput(''); setPending(null);
      await refresh();
    } catch (err: any) { setError(err.message || '发送失败，请重试。'); }
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
  return <section className={`ai-entry ${home ? 'ai-entry-home' : 'ai-entry-compact'}`} aria-label="AI 设计与咨询">
    {home && <header className="ai-entry-heading">
      <span className="ai-entry-eyebrow"><Sparkles size={14} /> 萌开了 · AI 设计顾问</span>
      <h1>你的想法，<span>从这里开始。</span></h1>
      <p>聊聊你想做什么。选型、加工、报价，一起把需求说清楚。</p>
    </header>}
    <div className="ai-entry-card">
      <div className="ai-entry-toolbar">
        <button className="ai-entry-history" onClick={() => setOpen(!open)} aria-expanded={open}><MessageSquare size={15} /> {home ? '咨询记录' : 'AI 设计顾问'} {open ? '▴' : '▾'}</button>
        <div className="ai-entry-account">
          <span aria-live="polite">{status ? status.trial_mode ? `剩余 ${status.trial_remaining} 条免费消息` : `AI 余额 ¥${money(status.balance_cny)}` : error ? '额度暂不可用' : '正在读取额度…'}</span>
          <button className="text-blue-700 underline" onClick={() => setRecharge(!recharge)}>充值</button>
          {user && <button className="underline" onClick={async () => { try { const data = await ApiService.aiRequest('/ledger'); setEntries(data.entries); } catch (e: any) { setError(e.message); } }}>收支记录</button>}
          <button className="underline" onClick={() => refresh().catch(err => setError(err.message))}>刷新余额</button>
        </div>
      </div>
      {open && <div className="max-h-80 overflow-y-auto space-y-3 mb-3" role="log" aria-label="咨询记录">
        {!messages.length && <p className="text-sm text-slate-500">描述型号、颜色、长度和加工需求，我会追问缺少的信息。首版支持单种型材文字估价。</p>}
        {messages.map((message, i) => <div key={i} className={`rounded-xl p-3 text-sm whitespace-pre-wrap ${message.role === 'user' ? 'bg-blue-50 ml-8' : 'bg-slate-50 mr-8'}`}><strong>{message.role === 'user' ? '你' : 'AI 顾问'}</strong><p>{message.content}</p></div>)}
        <button disabled={busy} className="text-xs underline" onClick={async () => { try { await ApiService.aiRequest('/reset', { visitor_token: visitor() }); setMessages([]); } catch (e: any) { setError(e.message); } }}>开始新咨询（不重置额度）</button>
      </div>}
      <form onSubmit={send} className="ai-entry-form">
        <label htmlFor="ai-design-request" className="sr-only">描述你的设计或型材需求</label>
        <textarea id="ai-design-request" ref={inputRef} enterKeyHint="send" maxLength={2000} rows={2} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder="想做点什么？例如：2020 粉色型材，1000mm，两端攻丝…" />
        <div className="ai-entry-form-footer">
          <span><Sparkles size={14} /> 从一句话开始</span>
          <button aria-label={busy ? '正在处理' : '发送需求'} disabled={busy || !status?.enabled || (!status?.configured && !status?.local_answers_available) || !input.trim()} className="ai-entry-send">{busy ? <span className="ai-entry-loading">···</span> : <><span>开始咨询</span><ArrowUp size={19} /></>}</button>
        </div>
      </form>
      {home && !messages.length && <div className="ai-entry-suggestions" aria-label="试试这些问题">
        {['报价需要提供什么信息', '两端攻丝是什么意思', '能做和图片一样的吗'].map(example => <button key={example} onClick={() => { setInput(example); inputRef.current?.focus(); }}><Plus size={13} />{example}</button>)}
      </div>}
      <div className="ai-entry-notices">
      <p className="text-xs text-slate-500 mb-3">游客及普通用户免费发送 3 条消息，回复追问也计入次数。VIP/VIP+ 使用账户额度。</p>
      {status && (!status.enabled || (!status.configured && !status.local_answers_available)) && <p className="text-sm text-amber-800 mb-3">AI 咨询暂未开通，您可以先使用<Link to="/quick-quote" className="underline">快速报价</Link>。</p>}
      {status?.enabled && !status.configured && status.local_answers_available && <p className="text-sm text-slate-600 mb-3">目前可回答已收录的常见问题；智能规格识别暂未开通，估价请使用<Link to="/quick-quote" className="underline">快速报价</Link>。</p>}
      </div>
      {error && <p className="text-sm text-red-700 mt-3" role="alert">{error}</p>}
      {recharge && <div className="mt-4 border-t pt-4 text-sm space-y-3">
        <p className="font-bold">AI 额度充值 · 充多少到账多少</p>
        {!user ? <p>请先<Link to="/login" className="text-blue-700 underline">登录</Link>，方便将充值额度记入您的账号。</p> : <>
          <div className="flex gap-2 items-center"><select aria-label="充值金额" value={amount} onChange={e => setAmount(Number(e.target.value))} className="border rounded-lg p-2">{[10, 30, 100].map(n => <option key={n} value={n}>¥{n}</option>)}</select><button disabled={paying} onClick={pay} className="rounded-lg bg-blue-600 text-white p-2">{paying ? '正在创建付款…' : '支付宝充值'}</button></div>
          <p>支付宝确认支付成功后自动到账。微信扫码付款由管理员核实后手动增加额度。</p>
          {status?.wechat_qr && <img src={status.wechat_qr} alt="微信收款码" className="w-44 h-44 object-contain border" />}
          <p>微信付款后请提供账号手机号、付款金额及交易凭证。{status?.wechat_contact ? `联系：${status.wechat_contact}` : '请联系网站客服核实到账。'}</p>
        </>}
      </div>}
      {entries && <div className="mt-4 border-t pt-3 text-xs"><button onClick={() => setEntries(null)} className="underline">关闭收支记录</button>{!entries.length && <p>暂无记录。</p>}{entries.map((entry, i) => <p key={i} className="mt-2">{new Date(entry.created_at).toLocaleString()} · {({ grant: '赠送', usage: '使用', trial: '试用', faq: '常见问答（免费）', manual: '人工调整', recharge: '充值' } as Record<string, string>)[entry.kind] || entry.kind} · {entry.amount_cny >= 0 ? '+' : ''}¥{money(entry.amount_cny)}</p>)}</div>}
    </div>
    {home && <div className="ai-entry-shortcuts"><span>也可以直接</span><Link to="/quick-quote">快速报价 <ArrowUpRight size={14} /></Link><Link to="/diy-designer">打开 3D 设计器 <ArrowUpRight size={14} /></Link><button onClick={() => document.getElementById('profile-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>浏览商品 <ArrowUpRight size={14} /></button></div>}
  </section>;
}
