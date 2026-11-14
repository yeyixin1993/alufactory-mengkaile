import React from 'react';
import type { Language, ProfileSide } from '../types';
import { describeAPillarMilling, getAPillarMillingFaces, getAPillarMillingLayout, getAPillarMillingSpecs, normalizeAPillarMillingConfig, type APillarMillingConfig } from '../data/aPillarMilling';

interface Props {
  model: string;
  length: number;
  value?: APillarMillingConfig;
  language: Language;
  onChange: (value: APillarMillingConfig | undefined) => void;
}

export default function APillarMillingControl({ model, length, value, language, onChange }: Props) {
  const specs = getAPillarMillingSpecs(model);
  if (!specs.length) return null;
  const tr = (cn: string, en: string, jp: string) => language === 'cn' ? cn : language === 'jp' ? jp : en;
  const faces = getAPillarMillingFaces(model);
  const layout = getAPillarMillingLayout(model, length, value);
  return <div data-testid="a-pillar-control" className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3">
    <label className="block text-xs font-bold text-blue-900">
      {tr('A柱铣型', 'A-pillar milling', 'A柱フライス加工')}
      <select data-testid="a-pillar-spec" className="mt-1 w-full rounded-lg border border-blue-200 bg-white p-2 text-sm" value={value?.specId || 'none'}
        onChange={event => onChange(normalizeAPillarMillingConfig(model, { specId: event.target.value, face: value?.face || faces[0] }))}>
        <option value="none">{tr('不加工A柱', 'No A-pillar milling', 'A柱加工なし')}</option>
        {specs.map(spec => <option key={spec.id} value={spec.id}>{spec.name[language]} · +{spec.feePerMeter}{tr('元/米', '/m', '元/m')}</option>)}
      </select>
    </label>
    {layout && <>
      <label className="block text-xs font-bold text-blue-900">
        {tr('开槽面（与二维图 A/B/C/D 一致）', 'Milling face (same A/B/C/D as diagram)', '加工面（図のA/B/C/Dに対応）')}
        <select data-testid="a-pillar-face" value={layout.face} onChange={event => onChange({ ...value!, face: event.target.value as ProfileSide })}
          className="mt-1 w-full rounded-lg border border-blue-200 bg-white p-2 text-sm">
          {faces.map(face => <option key={face} value={face}>{face}{tr('面', ' face', '面')}</option>)}
        </select>
      </label>
      <p className="text-xs leading-relaxed text-blue-900">{describeAPillarMilling(model, length, value, language)}</p>
      <p className="text-[11px] leading-relaxed text-slate-600">{tr('孔间净距11mm，居中排列，两端仅开完整孔。本色或彩色截面彩色；加工费按整根长度计。', '11 mm clear gap; centred pattern with complete slots only. Natural or color with colored ends; milling charged by profile length.', '穴間隔11mm。中央揃え、両端は完全な穴のみ。本色または断面同色。加工費はプロファイル全長で計算。')}</p>
    </>}
  </div>;
}
