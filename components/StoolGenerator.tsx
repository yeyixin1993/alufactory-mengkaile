import React, { useState } from 'react';
import { buildStoolTemplate, STOOL_BASELINE, validateStoolParameters } from '../utils/parametricStool';
import type { ParametricSceneItem } from '../utils/parametricFurniture';
import type { Language } from '../types';

/** Local geometry generation uses the same non-destructive import flow as JSON. */
export default function StoolGenerator({ language, onImport }: {
  language: Language;
  onImport: (items: ParametricSceneItem[]) => Promise<unknown>;
}) {
  const [dimensions, setDimensions] = useState(STOOL_BASELINE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const labels = language === 'cn' ? ['复古边几凳', '宽', '深', '主体高（不含脚轮）', '生成凳子草案']
    : language === 'jp' ? ['サイドテーブルスツール', '幅', '奥行', '本体高さ（キャスター除く）', '下書きを作成']
    : ['Side-table stool', 'Width', 'Depth', 'Body height (excluding casters)', 'Generate stool draft'];
  return <details className="mt-4 rounded-xl border border-slate-200 p-3">
    <summary className="cursor-pointer text-xs font-black text-slate-700">{labels[0]}</summary>
    <div className="mt-3 space-y-2">
      {(['widthMm', 'depthMm', 'heightMm'] as const).map((key, index) => <label key={key} className="block text-xs text-slate-600">
        {labels[index + 1]} · mm
        <input type="number" step={1} min={key === 'heightMm' ? 500 : 360} max={key === 'heightMm' ? 800 : 600}
          value={dimensions[key]} onChange={event => setDimensions(current => ({ ...current, [key]: Math.round(Number(event.target.value)) }))}
          className="mt-1 w-full rounded-lg border border-slate-200 p-2" />
      </label>)}
      <button type="button" disabled={busy} className="w-full rounded-lg bg-slate-900 p-2 text-xs font-bold text-white disabled:opacity-50" onClick={async () => {
        const validation = validateStoolParameters(dimensions);
        if (!validation.valid) { setError(validation.message); return; }
        setBusy(true); setError('');
        try { await onImport((await buildStoolTemplate(dimensions)).items); }
        catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
        finally { setBusy(false); }
      }}>{busy ? '…' : labels[4]}</button>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  </details>;
}
