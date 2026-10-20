import React from 'react';
import type { Language } from '../types';
import { getAccessoryKit, KIT_RATIOS } from '../utils/accessoryKit';

export default function AccessoryKitOption({ defId, series, enabled, onChange, language }: {
  defId: string; series: string; enabled: boolean; onChange: (value: boolean) => void; language: Language;
}) {
  if (!KIT_RATIOS[defId]) return null;
  const kit = getAccessoryKit(defId, series);
  if (series === '4040') return <label className="mt-2 flex gap-2 rounded-lg bg-slate-100 p-2 text-xs text-slate-400"><input type="checkbox" disabled checked={false} readOnly /><span>{language === 'cn' ? '4040 暂不配螺丝螺母' : '4040 installation kits unavailable'}</span></label>;
  if (!kit) return <p className="mt-2 text-xs text-amber-700">{language === 'cn' ? '配套规格待确认，当前仅配件' : language === 'jp' ? '取付部品の仕様確認待ち・部品のみ' : 'Kit specification pending — accessory only'}</p>;
  return <label className="mt-2 flex items-start gap-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-900">
    <input type="checkbox" checked={enabled} onChange={event => onChange(event.target.checked)} className="mt-0.5" />
    <span>{language === 'cn' ? `配齐安装件：每个 ${kit.screws} 颗螺丝${kit.nuts ? `＋${kit.nuts} 颗螺母` : '，无需螺母'}` : language === 'jp' ? `取付セット：ねじ ${kit.screws} 本・ナット ${kit.nuts} 個` : `Installation kit: ${kit.screws} screws + ${kit.nuts} nuts each`}
      <span className="block font-normal">{defId === '1' || defId === '3' ? (language === 'cn' ? '现价已含配套安装件，不另收费' : 'Installation hardware included in accessory price') : language === 'cn' ? '套装螺丝五折 · 螺母原价；已有安装件可取消' : language === 'jp' ? 'セットねじ50%引き・ナット通常価格。不要なら解除' : 'Kit screws 50% off · nuts regular price. Uncheck for accessory only.'}</span>
      <span className="block font-normal">{kit.screw.name[language]}{kit.nut ? ` / ${kit.nut.name[language]}` : ''}</span>
    </span>
  </label>;
}
