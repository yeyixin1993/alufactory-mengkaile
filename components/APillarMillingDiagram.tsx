import React from 'react';
import type { Language, ProfileConfig } from '../types';
import { getAPillarMillingLayout } from '../data/aPillarMilling';
import { getProfileVisualGrooveCount, profileSectionCenters } from '../utils/profileMachining';

/** Manufacturing view: both axes use the same scale as the designer geometry.
 * The full-length view keeps every slot; the enlarged start section makes the
 * long axis unambiguous even when a 3m profile is printed on an A4 sheet. */
const APillarMillingDiagram: React.FC<{ config: ProfileConfig; language?: Language }> = ({ config, language = 'cn' }) => {
  const model = config.variantId || '';
  const layout = getAPillarMillingLayout(model, config.length, config.aPillarMilling);
  if (!layout || config.length <= 0) return null;
  const tr = (cn: string, en: string, jp: string) => language === 'en' ? en : language === 'jp' ? jp : cn;
  const size = model.match(/^(\d{2})(\d{2,3})/)!;
  const width = Number(size[1]), height = Number(size[2]);
  const faceWidth = layout.face === 'A' || layout.face === 'C' ? width : height;
  const grooves = getProfileVisualGrooveCount(model, layout.face);
  const grooveCenters = grooves ? profileSectionCenters(faceWidth, grooves, model) : [];
  const grooveWidth = Math.min(width, height) * 0.26; // Same opening as the designer's extrusion.
  const first = layout.centersMm[0];
  const zoomLength = Math.min(config.length, (first ?? 0) + layout.pitchMm * 2 + layout.heightMm / 2 + 10);
  const zoomCenters = layout.centersMm.filter(center => center + layout.heightMm / 2 <= zoomLength);
  const fullScale = Math.min(230 / config.length, 60 / faceWidth);
  const zoomScale = Math.min(230 / zoomLength, 135 / faceWidth);
  const fullX = 80 - faceWidth * fullScale / 2, fullY = 46;
  const zoomX = 285, zoomY = 46;
  const total = layout.centersMm.length * layout.columnOffsetsMm.length;
  const line = { stroke: '#475569', strokeWidth: 1 };
  const drawFace = (span: number, centers: number[], detail: boolean) => <>
    <rect width={faceWidth} height={span} fill="#d5dbe1" stroke="#64748b" strokeWidth={0.25} />
    {grooveCenters.map(center => <rect key={center} x={faceWidth / 2 + center - grooveWidth / 2}
      y={0} width={grooveWidth} height={span} fill="#9ba6af" />)}
    {centers.flatMap(center => layout.columnOffsetsMm.map(offset => <rect key={`${center}:${offset}`}
      data-testid={detail ? 'profile-a-pillar-detail-slot' : 'profile-a-pillar-slot'}
      data-center-mm={center} data-column-offset-mm={offset}
      x={faceWidth / 2 + offset - layout.widthMm / 2} y={center - layout.heightMm / 2}
      width={layout.widthMm} height={layout.heightMm} rx={0.75} fill="#263440" />))}
  </>;

  return <div data-testid="profile-a-pillar-diagram" className="w-full" data-pdf-keep-together
    style={{ color: '#0f172a', breakInside: 'avoid', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
    <p className="text-xs font-bold mb-2 text-blue-900">
      {tr(`A柱 ${layout.face}面 · 槽孔长边沿型材长度方向`, `A-pillar face ${layout.face} · Slot long axis follows profile length`, `A柱 ${layout.face}面 · 長穴の長辺は型材の長手方向`)}
    </p>
    <svg data-testid="profile-a-pillar-pattern" data-face={layout.face} data-slot-count={total}
      data-length-axis="vertical" viewBox="0 0 600 312" preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', width: '100%', height: 'auto' }}
      role="img" aria-label={tr(`A柱${layout.spec.name.cn}，宽${layout.widthMm}mm，沿型材长14mm，中心距25mm`,
        `A-pillar ${layout.spec.name.en}, ${layout.widthMm}mm across, 14mm along profile, 25mm pitch`,
        `A柱${layout.spec.name.jp}、幅${layout.widthMm}mm、長手14mm、ピッチ25mm`)}>
      <g fontFamily="sans-serif" fontSize="12" fill="#334155">
        <text x="80" y="18" textAnchor="middle">{tr('全长概览', 'Full length', '全長')}</text>
        <text x="355" y="18" textAnchor="middle">{tr('起点局部放大（等比例）', 'Start detail (proportional)', '始点拡大（縦横同倍率）')}</text>
        <g data-testid="a-pillar-full-scale" transform={`translate(${fullX} ${fullY}) scale(${fullScale})`}>
          {drawFace(config.length, layout.centersMm, false)}
        </g>
        <text x="110" y={fullY + 4}>0 mm</text>
        <text x="110" y={fullY + config.length * fullScale}>{config.length} mm</text>
        <text x="80" y="301" textAnchor="middle">{tr(`共 ${total} 孔`, `${total} slots`, `計 ${total} 穴`)}</text>

        <line x1="205" y1="60" x2="205" y2="260" {...line} />
        <path d="M200 250 L205 260 L210 250" fill="none" {...line} />
        <text transform="translate(193 160) rotate(-90)" textAnchor="middle">{tr('型材长度方向', 'Profile length', '型材長手方向')}</text>
        <g data-testid="a-pillar-detail-scale" transform={`translate(${zoomX} ${zoomY}) scale(${zoomScale})`}>
          {drawFace(zoomLength, zoomCenters, true)}
        </g>
        {zoomLength < config.length && <>
          <path d={`M${zoomX - 3} ${zoomY + zoomLength * zoomScale - 4} l${faceWidth * zoomScale / 3} -4 l${faceWidth * zoomScale / 3} 8 l${faceWidth * zoomScale / 3 + 6} -4`}
            fill="none" stroke="#fff" strokeWidth="4" />
          <text x={zoomX + faceWidth * zoomScale / 2} y="301" textAnchor="middle">{tr('其余按 25mm 中心距重复', 'Repeat at 25mm pitch', '以降25mmピッチで繰返し')}</text>
        </>}
        {first !== undefined && (() => {
          const centerX = zoomX + (faceWidth / 2 + layout.columnOffsetsMm.at(-1)!) * zoomScale;
          const top = zoomY + (first - layout.heightMm / 2) * zoomScale;
          const bottom = top + layout.heightMm * zoomScale;
          const left = centerX - layout.widthMm * zoomScale / 2;
          const right = centerX + layout.widthMm * zoomScale / 2;
          const lengthX = zoomX + faceWidth * zoomScale + 15;
          const pitchX = lengthX + 75;
          return <>
            <g data-testid="a-pillar-width-dimension">
              <line x1={left} y1={top - 9} x2={right} y2={top - 9} {...line} />
              <line x1={left} y1={top - 13} x2={left} y2={top - 5} {...line} />
              <line x1={right} y1={top - 13} x2={right} y2={top - 5} {...line} />
              <text x={centerX} y={top - 17} textAnchor="middle">{layout.widthMm} mm</text>
            </g>
            <g data-testid="a-pillar-length-dimension">
              <line x1={lengthX} y1={top} x2={lengthX} y2={bottom} {...line} />
              {[top, bottom].map(y => <line key={y} x1={right + 3} y1={y} x2={lengthX + 4} y2={y} {...line} strokeDasharray="2 2" />)}
              <text x={lengthX + 7} y={(top + bottom) / 2 + 4}>14 mm</text>
            </g>
            {zoomCenters.length > 1 && <g data-testid="a-pillar-pitch-dimension">
              <line x1={pitchX} y1={zoomY + first * zoomScale} x2={pitchX} y2={zoomY + (first + layout.pitchMm) * zoomScale} {...line} />
              {[first, first + layout.pitchMm].map(center => <line key={center} x1={lengthX + 60} y1={zoomY + center * zoomScale} x2={pitchX + 4} y2={zoomY + center * zoomScale} {...line} strokeDasharray="2 2" />)}
              <text x={pitchX + 7} y={zoomY + (first + layout.pitchMm / 2) * zoomScale + 4}>25 mm</text>
            </g>}
          </>;
        })()}
      </g>
    </svg>
    <p className="text-[10px] text-slate-600 mt-1">
      {tr(`孔宽 ${layout.widthMm}mm · 沿型材长 ${layout.heightMm}mm · 孔间净距 ${layout.pitchMm - layout.heightMm}mm${layout.columnOffsetsMm.length === 2 ? ' · 双排横向净距 5mm' : ''}`,
        `Width ${layout.widthMm}mm · Length along profile ${layout.heightMm}mm · Gap ${layout.pitchMm - layout.heightMm}mm${layout.columnOffsetsMm.length === 2 ? ' · 5mm gap between columns' : ''}`,
        `穴幅 ${layout.widthMm}mm · 長手 ${layout.heightMm}mm · 穴間 ${layout.pitchMm - layout.heightMm}mm${layout.columnOffsetsMm.length === 2 ? ' · 列間隙間 5mm' : ''}`)}
    </p>
  </div>;
};

export default APillarMillingDiagram;
