import React, {useState, useId, useRef, useEffect} from 'react';
import { CircleAlert } from 'lucide-react';
import { Language } from '../types';

const COPY: Record<Language, { title: string; natural: string; colored: string; palette: string }> = {
  cn: {
    title: '截面本色与截面彩色',
    natural: '截面本色：切口保留铝材银白本色。',
    colored: '截面彩色：表面与切口均为所选颜色。',
    palette: '彩色截面可选颜色（实际颜色以实物为准）',
  },
  en: {
    title: 'Natural vs. colored cut ends',
    natural: 'Natural: the cut end stays silver aluminum.',
    colored: 'Colored: the surface and cut end use the selected color.',
    palette: 'Colored-section options (physical samples are authoritative)',
  },
  jp: {
    title: 'ナチュラル断面とカラー断面',
    natural: 'ナチュラル：切断面はアルミ本来の銀白色です。',
    colored: 'カラー：表面と切断面を選択色で仕上げます。',
    palette: 'カラー断面の選択色（実物サンプル優先）',
  },
};

const ProfileSectionGuide: React.FC<{ language: Language; showPalette?: boolean; compact?: boolean }> = ({ language, showPalette = true, compact=false }) => {
  const copy = COPY[language];

  const [hover,setHover]=useState(false),[pinned,setPinned]=useState(false);
  const id=useId();const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!pinned)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setPinned(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[pinned]);
  const content=(

    <aside className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
      <div className="flex items-center gap-3">
        <img
          src="/images/profile-section-natural-vs-colored.jpg"
          alt={copy.title}
          loading="lazy"
          decoding="async"
          className="h-16 w-20 shrink-0 rounded-lg border border-amber-100 object-cover"
        />
        <div className="space-y-0.5 text-xs leading-relaxed text-slate-600">
          <h4 className="font-black text-slate-800">{copy.title}</h4>
          <p>{copy.natural}</p>
          <p>{copy.colored}</p>
        </div>
      </div>
      {showPalette && (
        <figure className="overflow-hidden rounded-lg border border-amber-100 bg-white p-2">
          <img
            src="/images/profile-color-overview.jpg"
            alt={copy.palette}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className="mx-auto max-h-72 w-full object-contain"
          />
          <figcaption className="mt-1 text-center text-[10px] font-bold text-slate-400">{copy.palette}</figcaption>
        </figure>
      )}
    </aside>
  );
  if(!compact)return content;
  return <div ref={root} className="relative inline-flex" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onKeyDown={e=>{if(e.key==='Escape'){setPinned(false);setHover(false);}}}>
    <button type="button" aria-label={copy.title} aria-expanded={hover||pinned} aria-controls={id} onClick={()=>{setPinned(v=>!v);setHover(false);}} className="rounded-full p-1 text-slate-400 hover:text-blue-600 focus-visible:outline-blue-500"><CircleAlert size={16}/></button>
    {(hover||pinned)&&<div id={id} role="region" aria-label={copy.title} className="absolute right-0 top-full z-50 w-[min(320px,80vw)] max-h-[60vh] overflow-y-auto rounded-xl bg-white shadow-xl normal-case tracking-normal">{content}</div>}
  </div>;
};

export default ProfileSectionGuide;
