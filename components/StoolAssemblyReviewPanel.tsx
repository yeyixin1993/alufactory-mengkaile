import React, { useMemo } from 'react';
import { ChevronDown, LocateFixed, Wrench } from 'lucide-react';
import type { Language } from '../types';
import {
  reviewStoolAssembly,
  STOOL_ASSEMBLY_INSTALLATION_STEPS,
  type StoolAssemblyGroupReview,
  type StoolAssemblyReviewItem,
  type StoolMountReview,
} from '../utils/stoolAssemblyReview';

export interface StoolAssemblyReviewPanelProps {
  items: readonly StoolAssemblyReviewItem[];
  language?: Language;
  onFocusItem: (id: string) => void;
}

const COPY = {
  cn: {
    title: '整凳装配复核', pending: '层间紧固待核',
    distinction: '框内连接检查不等于整凳已装好。',
    supports: '固定件 / 应有', mounts: '已对位 / 应有安装位',
    contactOnly: '孔位对准仅表示几何贴合，尚未确认紧固。',
    candidates: '紧固件候选',
    screws: (n: number) => `${n} 颗 M6×12 圆柱头螺丝`,
    nuts: (n: number) => `${n} 个 3030 M6 槽螺母`,
    candidateNote: '未选定采购型号，未生成紧固件实体；垫片、啮合量与工具净空待核。',
    attention: '存在缺件、重复件或安装位失配，展开对应凳子定位。',
    assembly: (n: number) => `凳子 ${n}`,
    frames: (n: number, groups: number) => `三层框架 · ${n} 根型材 · ${groups} 个框内连通分量`,
    componentSizes: (sizes: string) => `各分量型材数：${sizes}。层间固定件尚未计为已紧固连接。`,
    missing: (n: number) => `缺少 ${n} 个固定件`,
    misplaced: (n: number) => `${n} 个安装位失配`,
    profileCount: (n: number) => `型材 ${n}/32，需检查缺件或分组。`,
    supportCount: (n: number) => `固定件 ${n}/16，需检查缺件或重复。`,
    noSupport: '当前没有可定位的固定件。',
    focus: '定位固定件', profile: '定位型材', hole: (n: number) => `孔 ${n}`,
    aligned: (n: number, total: number) => `${n}/${total} 对位`,
    statuses: { matched: '已对位', missing_mating_face: '缺配合面', ambiguous_mating_face: '配合面不唯一', source_geometry_changed: '源几何或姿态变化' },
    steps: '建议安装顺序', stepsNote: '按每张凳子执行；实物安装条件仍需确认。',
  },
  en: {
    title: 'Stool assembly review', pending: 'Tier fasteners unverified',
    distinction: 'Frame-joint checks do not mean the complete stool is assembled.',
    supports: 'Supports / expected', mounts: 'Aligned / expected mounts',
    contactOnly: 'Aligned holes indicate geometric contact, not verified fastening.',
    candidates: 'Fastener candidates',
    screws: (n: number) => `${n} M6×12 socket-head screws`,
    nuts: (n: number) => `${n} 3030 M6 T-slot nuts`,
    candidateNote: 'No procurement model selected or fastener bodies generated. Washers, engagement and tool clearance remain unverified.',
    attention: 'Missing, duplicate or misaligned parts need review. Expand the stool to locate them.',
    assembly: (n: number) => `Stool ${n}`,
    frames: (n: number, groups: number) => `Three-tier frame · ${n} profiles · ${groups} frame connection groups`,
    componentSizes: (sizes: string) => `Profiles per group: ${sizes}. Tier supports are not counted as fastened connections.`,
    missing: (n: number) => `${n} supports missing`,
    misplaced: (n: number) => `${n} mounts misaligned`,
    profileCount: (n: number) => `${n}/32 profiles; check missing parts or grouping.`,
    supportCount: (n: number) => `${n}/16 supports; check missing or duplicate parts.`,
    noSupport: 'No support remains to locate.',
    focus: 'Locate support', profile: 'Locate profile', hole: (n: number) => `Hole ${n}`,
    aligned: (n: number, total: number) => `${n}/${total} aligned`,
    statuses: { matched: 'Aligned', missing_mating_face: 'No mating face', ambiguous_mating_face: 'Ambiguous mating face', source_geometry_changed: 'Geometry or pose changed' },
    steps: 'Suggested assembly order', stepsNote: 'Repeat for each stool; verify physical installation conditions.',
  },
  jp: {
    title: 'スツール組立確認', pending: '層間の締結は未確認',
    distinction: '枠内接続の確認だけでは、スツール全体の組立完了にはなりません。',
    supports: '固定金具 / 必要数', mounts: '位置一致 / 必要取付位置',
    contactOnly: '穴の一致は幾何学的な接触です。締結の確認は未完了です。',
    candidates: '締結部品の候補',
    screws: (n: number) => `M6×12 六角穴付きボルト ${n} 本`,
    nuts: (n: number) => `3030 M6 溝ナット ${n} 個`,
    candidateNote: '購入型番は未選定、締結部品の実体も未生成です。ワッシャー・ねじ掛かり・工具空間は要確認です。',
    attention: '不足・重複・取付位置の不一致があります。該当スツールを開いて確認してください。',
    assembly: (n: number) => `スツール ${n}`,
    frames: (n: number, groups: number) => `三層フレーム · 型材 ${n} 本 · 枠内接続 ${groups} 群`,
    componentSizes: (sizes: string) => `各群の型材数：${sizes}。層間金具は締結済み接続に含めません。`,
    missing: (n: number) => `固定金具 ${n} 個不足`,
    misplaced: (n: number) => `取付位置 ${n} 箇所不一致`,
    profileCount: (n: number) => `型材 ${n}/32。本数・所属を確認してください。`,
    supportCount: (n: number) => `固定金具 ${n}/16。不足・重複を確認してください。`,
    noSupport: '位置を表示できる固定金具がありません。',
    focus: '固定金具を表示', profile: '型材を表示', hole: (n: number) => `穴 ${n}`,
    aligned: (n: number, total: number) => `${n}/${total} 一致`,
    statuses: { matched: '位置一致', missing_mating_face: '相手面なし', ambiguous_mating_face: '相手面が複数', source_geometry_changed: '形状・姿勢が変化' },
    steps: '推奨組立順序', stepsNote: '各スツールで実施し、実物の取付条件を確認してください。',
  },
} as const;

const INSTALLATION_STEPS = {
  cn: STOOL_ASSEMBLY_INSTALLATION_STEPS,
  en: [
    'Finish the main frame and 80 mm decorative posts first. Tighten their upper drill-and-tap screws before stacking the middle and seat frames.',
    'Fit the eight lower supports between the fixed upper frame and middle frame. Position slot nuts first, then tighten the middle-frame underside screws through the inner opening.',
    'Preassemble the eight upper supports on the detached seat frame and tighten the upward screws. The lower fixed frame will restrict straight-tool access later.',
    'Lower the seat frame and its supports onto the middle frame. Tighten horizontal screws through the 30 mm tier gaps; confirm nuts, thread engagement and tool clearance physically.',
  ],
  jp: [
    '主体と80 mmの装飾短柱を先に組み立てます。中枠・座枠を重ねる前に、上端の穴あけ・タップ接続ねじを締めます。',
    '下層の固定金具8個で固定上枠と中枠を接続します。溝ナットを先に配置し、内側の開口から中枠下面のねじを締めます。',
    '取り外した座枠に上層の固定金具8個を先付けし、上向きのねじを締めます。組立後は下の固定枠が工具の進入を制限します。',
    '座枠と上層金具を中枠へ下ろし、周囲の30 mm隙間から水平ねじを締めます。ナット・ねじ掛かり・工具空間を実物で確認します。',
  ],
} as const;

const supportLabel = (label: string, language: Language) => {
  if (language === 'cn') return label;
  const replacements = language === 'en'
    ? [['前侧', 'Front '], ['后侧', 'Rear '], ['左侧', 'Left '], ['右侧', 'Right '], ['下层', 'lower '], ['上层', 'upper '], ['固定件', 'support ']]
    : [['前侧', '前側'], ['后侧', '後側'], ['左侧', '左側'], ['右侧', '右側'], ['下层', '下層'], ['上层', '上層'], ['固定件', '固定金具']];
  return replacements.reduce((text, [from, to]) => text.replace(from, to), label);
};

const hasAssemblyIssues = (assembly: StoolAssemblyGroupReview) => assembly.missingSupportCount > 0
  || assembly.unmatchedMountCount > 0 || assembly.supportCount !== assembly.expectedSupportCount || assembly.profileIds.length !== 32;

const StoolAssemblyReviewPanel: React.FC<StoolAssemblyReviewPanelProps> = ({ items, language = 'cn', onFocusItem }: StoolAssemblyReviewPanelProps) => {
  const review = useMemo(() => reviewStoolAssembly(items), [items]);
  if (!review.applicable) return null;
  const copy = COPY[language];
  const totals = review.totals;
  const hasIssues = review.assemblies.some(hasAssemblyIssues);
  const holeTitle = (hole: StoolMountReview) => `${copy.statuses[hole.matchStatus]} · ${hole.worldCenterMm.map(n => Number(n.toFixed(2))).join(', ')} mm`;

  return (
    <section data-testid="stool-assembly-review" data-status={hasIssues ? 'needs-alignment' : 'fastening-unverified'} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-700">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900"><Wrench size={14} aria-hidden="true" />{copy.title}</h3>
        <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">{copy.pending}</span>
      </header>
      <p className="mt-2 text-xs font-semibold leading-5">{copy.distinction}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg bg-slate-50 px-2.5 py-2"><span className="block text-slate-500">{copy.supports}</span><strong data-testid="stool-support-count" className="mt-0.5 block text-base text-slate-900">{totals.supports} / {totals.expectedSupports}</strong></div>
        <div className="rounded-lg bg-slate-50 px-2.5 py-2"><span className="block text-slate-500">{copy.mounts}</span><strong data-testid="stool-mount-count" className="mt-0.5 block text-base text-slate-900">{totals.matchedMounts} / {totals.expectedSupports * 2}</strong></div>
      </div>
      <p className="mt-1.5 text-[10px] leading-4 text-slate-500">{copy.contactOnly}</p>
      <div data-testid="stool-fastener-candidates" className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-5">
        <p className="font-semibold">{copy.candidates}</p>
        <p>{copy.screws(totals.candidateScrews)}<br />{copy.nuts(totals.candidateNuts)}</p>
        <p className="mt-1 text-[10px] leading-4 text-slate-500">{copy.candidateNote}</p>
      </div>
      {hasIssues && <p role="status" data-testid="stool-assembly-issues" className="mt-2 rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] leading-5 text-rose-800">{copy.attention}</p>}
      <div className="mt-3 space-y-2">
        {review.assemblies.map((assembly, index) => (
          <details key={assembly.scopeId} open={hasAssemblyIssues(assembly)} className="group rounded-lg border border-slate-200" data-testid="stool-assembly-group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-2 p-2 text-[11px] [&::-webkit-details-marker]:hidden">
              <span><strong className="block text-slate-800">{copy.assembly(index + 1)}</strong><span className="mt-0.5 block leading-4 text-slate-500">{copy.frames(assembly.profileIds.length, assembly.profileComponents.length)}</span></span>
              <ChevronDown size={14} className="mt-0.5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="border-t border-slate-100 p-2 text-[10px] leading-4">
              <p className="mb-2 text-slate-500">{copy.componentSizes(assembly.profileComponents.map(component => component.length).join(' + ') || '0')}</p>
              {assembly.profileIds.length !== 32 && <p className="mb-1 text-rose-700">{copy.profileCount(assembly.profileIds.length)}</p>}
              {assembly.supportCount !== assembly.expectedSupportCount && <p className="mb-1 text-rose-700">{copy.supportCount(assembly.supportCount)}</p>}
              {assembly.missingSupportCount > 0 && <p className="mb-2 text-rose-700">{copy.missing(assembly.missingSupportCount)}：{assembly.missingSupportLabels.map(label => supportLabel(label, language)).join(' · ')}</p>}
              {assembly.unmatchedMountCount > 0 && <p className="mb-2 font-semibold text-rose-700">{copy.misplaced(assembly.unmatchedMountCount)}</p>}
              <div className="max-h-72 space-y-1.5 overflow-y-auto overscroll-contain">
                {assembly.supports.map(support => {
                  const aligned = support.holes.filter(hole => hole.matchStatus === 'matched').length;
                  return <div key={support.itemId} className={`rounded-md border px-2 py-1.5 ${aligned === support.holes.length ? 'border-slate-100 bg-slate-50' : 'border-rose-200 bg-rose-50/60'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" onClick={() => onFocusItem(support.itemId)} title={copy.focus} data-testid="stool-support-focus" className="inline-flex min-h-8 items-center gap-1 text-left font-semibold text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><LocateFixed size={12} className="shrink-0" aria-hidden="true" />{supportLabel(support.label, language)}</button>
                      <span className={`shrink-0 ${aligned === support.holes.length ? 'text-slate-500' : 'text-rose-700'}`}>{copy.aligned(aligned, support.holes.length)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {support.holes.map((hole, holeIndex) => (
                        <button key={hole.id} type="button" onClick={() => onFocusItem(hole.profileId || support.itemId)} title={`${holeTitle(hole)} · ${hole.profileId ? copy.profile : copy.focus}`} data-testid="stool-mount-focus" className={`min-h-8 rounded border bg-white px-1.5 text-left hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${hole.matchStatus === 'matched' ? 'border-slate-200 text-slate-600' : 'border-rose-200 text-rose-700'}`}>
                          {copy.hole(holeIndex + 1)} · {hole.profileId ? copy.profile : copy.statuses[hole.matchStatus]}
                        </button>
                      ))}
                    </div>
                  </div>;
                })}
                {assembly.supports.length === 0 && <p className="py-1 text-slate-500">{copy.noSupport}</p>}
              </div>
            </div>
          </details>
        ))}
      </div>
      <details className="mt-3 border-t border-slate-100 pt-2 text-[11px]" data-testid="stool-installation-steps">
        <summary className="cursor-pointer font-semibold text-slate-800">{copy.steps}</summary>
        <ol className="mt-2 list-decimal space-y-2 pl-4 leading-5">{INSTALLATION_STEPS[language].map((step, index) => <li key={index}>{step}</li>)}</ol>
        <p className="mt-2 text-[10px] leading-4 text-slate-500">{copy.stepsNote}</p>
      </details>
    </section>
  );
};

export default StoolAssemblyReviewPanel;
