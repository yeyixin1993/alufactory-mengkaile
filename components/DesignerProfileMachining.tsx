import React, { useState } from 'react';
import { DraftNumberInput, NumericActionButton } from './DraftNumberInput';
import ProfileVisualizer from './ProfileVisualizer';
import { DrillHole, HoleType, Language, ProfileSide, ThreadSize } from '../types';
import { describeHolePassage, displayGrooveToPhysical, getHoleDisplayGrooveIndex, getProfileGrooveCount, grooveOrdinal } from '../utils/profileMachining';

interface Props {
  variantId: string;
  length: number;
  colorId: string;
  holes: DrillHole[];
  language: Language;
  tapping: { left: boolean[]; right: boolean[] };
  onChange: (holes: DrillHole[]) => void;
  onDrill3D: () => void;
  onToggleTapping: (end: 'left' | 'right') => void;
}

/** P2's actual machining diagram, backed by the designer's ordinary undoable hole data. */
const DesignerProfileMachining: React.FC<Props> = ({ variantId, length, colorId, holes, language, tapping, onChange, onDrill3D, onToggleTapping }) => {
  const tr = (cn: string, en: string, jp: string) => language === 'cn' ? cn : language === 'jp' ? jp : en;
  const [side, setSide] = useState<ProfileSide>('A');
  const [position, setPosition] = useState(Math.min(100, Math.round(length / 2)));
  const [groove, setGroove] = useState(0);
  const [type, setType] = useState<HoleType>('through');
  const [thread, setThread] = useState<ThreadSize>('M6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftVisible, setDraftVisible] = useState(false);
  const [error, setError] = useState('');
  const [inputRevision, setInputRevision] = useState(0);
  const existing = holes.find(hole => hole.id === editingId);
  const count = Math.max(1, getProfileGrooveCount(variantId, side));
  const displayGroove = Math.min(groove, count - 1);
  const valid = Number.isFinite(position) && Number.isInteger(position) && position >= 5 && position <= length - 5;
  const draft: DrillHole = {
    ...existing,
    id: '__designer_hole_draft__', side, positionMm: position, type,
    threadSize: type === 'threaded' ? thread : undefined,
    grooveIndex: displayGroove,
    physicalGrooveIndex: displayGrooveToPhysical(side, displayGroove, count),
  };
  const cancel = () => { setEditingId(null); setDraftVisible(false); setError(''); setInputRevision(value => value + 1); };
  const edit = (id: string) => {
    const hole = holes.find(entry => entry.id === id);
    if (!hole) return;
    // Opening a hole from its exit face must not reverse a countersink's entry.
    setSide(hole.side); setPosition(hole.positionMm);
    setGroove(getHoleDisplayGrooveIndex(hole, hole.side, variantId));
    setType(hole.type); setThread(hole.threadSize || 'M6');
    setEditingId(id); setDraftVisible(true); setError(''); setInputRevision(value => value + 1);
  };
  const save = () => {
    if (!valid || (editingId && !existing)) {
      setError(tr('请输入距端至少 5mm 的整数孔位；孔已删除时请重新选点。', 'Enter a whole-mm position at least 5mm from either end; select again if the hole was deleted.', '端から5mm以上の整数位置を入力してください。削除済みの穴は再選択してください。'));
      return;
    }
    const hole = { ...draft, id: existing?.id || crypto.randomUUID() };
    onChange(existing ? holes.map(entry => entry.id === existing.id ? hole : entry) : [...holes, hole]);
    cancel();
  };
  return <div data-testid="diy-machining-editor" data-numeric-scope className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-black text-blue-900">{tr('打孔 / 攻丝', 'Drilling / tapping', '穴加工 / タップ')}</h3>
      <button type="button" onClick={onDrill3D} className="rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs font-bold text-blue-700">{tr('3D 点选', 'Pick in 3D', '3Dで選択')}</button>
    </div>
    <p className="text-xs text-blue-800">{tr('选面 → 点击图中槽位 → 输入距端尺寸 → 确认。点击已有孔可编辑。', 'Choose a face → click a slot → enter end distance → confirm. Click an existing hole to edit.', '面を選択 → 溝をクリック → 端からの距離を入力 → 確定。既存の穴はクリックで編集。')}</p>
    <div className="rounded-xl border border-blue-100 bg-white p-2">
      <ProfileVisualizer config={{ variantId, length, colorId, tapping, holes: draftVisible && valid ? [...holes.filter(hole => hole.id !== editingId), draft] : holes }}
        selectedSide={side} onSideChange={next => { setSide(next); setGroove(0); }} interactive tapLabel={tr('攻丝', 'Tap', 'タップ')}
        onTapToggle={end => onToggleTapping(end)}
        previewHoleId={draftVisible ? draft.id : undefined}
        onHoleClick={id => { if (id !== draft.id) edit(id); }}
        onBarClick={(event, span, rect) => {
          setPosition(Math.max(5, Math.min(span - 5, Math.round((event.clientX - rect.left) / rect.width * span))));
          setGroove(Math.max(0, Math.min(count - 1, Math.floor((event.clientY - rect.top) / rect.height * count))));
          setDraftVisible(true); setError('');
        }} />
    </div>
    <p className="text-xs font-bold text-blue-800">{draftVisible ? tr('待确认', 'Pending confirmation', '未確定') : tr('新孔', 'New hole', '新しい穴')} · {describeHolePassage(draft, variantId, language)}</p>
    <div className="grid grid-cols-2 gap-2">
      {(['left', 'right'] as const).map(end => <label key={end} className="text-xs font-bold text-slate-700">
        {end === 'left' ? tr('距起点 (mm)', 'From start (mm)', '始点から (mm)') : tr('距终点 (mm)', 'From end (mm)', '終点から (mm)')}
        <DraftNumberInput key={`${end}:${inputRevision}`} aria-label={end === 'left' ? 'hole-distance-start' : 'hole-distance-end'} min={5} max={length - 5} step={1} required
          value={end === 'left' ? position : length - position} onChange={event => { setPosition(end === 'left' ? Number(event.target.value) : length - Number(event.target.value)); setDraftVisible(true); }}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" />
      </label>)}
    </div>
    {count > 1 && <div className="flex flex-wrap gap-2">{Array.from({ length: count }, (_, index) => <button type="button" key={index} onClick={() => { setGroove(index); setDraftVisible(true); }} className={`rounded-lg border px-3 py-2 text-xs ${displayGroove === index ? 'border-blue-600 bg-blue-100 text-blue-800' : 'bg-white'}`}>{grooveOrdinal(index, language)}</button>)}</div>}
    <div className="grid grid-cols-3 gap-2">{(['through', 'countersunk', 'threaded'] as const).map(value => <button type="button" key={value} onClick={() => { setType(value); setDraftVisible(true); }} className={`rounded-lg border px-2 py-2 text-xs font-bold ${type === value ? 'border-blue-600 bg-blue-100 text-blue-800' : 'bg-white'}`}>
      {value === 'through' ? tr('通孔', 'Through', '貫通穴') : value === 'countersunk' ? tr('沉孔', 'Counterbore', '座ぐり穴') : tr('螺纹孔', 'Threaded', 'ねじ穴')}
    </button>)}</div>
    {type === 'threaded' && <label className="block text-xs">{tr('螺纹规格', 'Thread size', 'ねじサイズ')}<select className="diy-select" value={thread} onChange={event => { setThread(event.target.value as ThreadSize); setDraftVisible(true); }}>{['M3','M4','M5','M6','M8'].map(size => <option key={size}>{size}</option>)}</select></label>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <div className="flex gap-2">
      <NumericActionButton onClick={save} className="flex-1 rounded-xl bg-blue-600 p-3 text-xs font-bold text-white">{existing ? tr('保存修改', 'Save changes', '変更を保存') : tr('开孔', 'Add hole', '穴を追加')}</NumericActionButton>
      <button type="button" onClick={cancel} className="rounded-xl border bg-white px-3 text-xs">{tr('取消', 'Cancel', '取消')}</button>
    </div>
    <div className="space-y-2">{holes.map(hole => <div key={hole.id} className={`flex flex-wrap items-center gap-2 rounded-lg border bg-white p-2 text-xs ${editingId === hole.id ? 'border-blue-500 ring-1 ring-blue-100' : 'border-slate-200'}`}>
      <button type="button" onClick={() => edit(hole.id)} className="flex-1 text-left font-bold text-slate-700">{describeHolePassage(hole, variantId, language)} · {hole.positionMm}mm · {hole.type === 'through' ? tr('通孔', 'Through', '貫通穴') : hole.type === 'countersunk' ? tr('沉孔', 'Counterbore', '座ぐり穴') : hole.threadSize}</button>
      <button type="button" onClick={() => edit(hole.id)} className="rounded-lg bg-blue-50 px-3 py-2 font-bold text-blue-700">{tr('编辑', 'Edit', '編集')}</button>
      <button type="button" onClick={() => { onChange(holes.filter(entry => entry.id !== hole.id)); if (editingId === hole.id) cancel(); }} className="p-2 text-slate-500 hover:text-red-600">{tr('删除', 'Delete', '削除')}</button>
    </div>)}</div>
  </div>;
};

export default DesignerProfileMachining;
