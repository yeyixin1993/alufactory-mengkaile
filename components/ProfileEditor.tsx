
// Add missing React import to fix namespace errors
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DrillHole, ProfileConfig, ProfileSide, TappingConfig, Language, HoleType, ProfileFinish, CartItem, Product, MiterCutConfig, MiterCutDirection, MiterCutSide } from '../types';
import { TRANSLATIONS, PROFILE_VARIANTS, PROFILE_COLORS } from '../constants';
import { Plus, Trash2, List, ShoppingCart, Pencil, X, Hammer, Settings2 } from 'lucide-react';
import ProfileVisualizer from './ProfileVisualizer';

interface ProfileEditorProps {
  language: Language;
  product: Product;
  initialItem?: CartItem;
  onAddBatchToCart: (items: CartItem[]) => void;
  onUpdateItem: (item: CartItem) => void;
  draftProfiles: CartItem[];
  setDraftProfiles: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

const getCurrency = (lang: Language) => lang === 'cn' ? '￥' : '$';

const PRICE_HOLE_THROUGH = 1.0;
const PRICE_HOLE_COUNTERSUNK = 1.8;
const PRICE_TAPPING_PER_END = 1.5;
const PRICE_MITER_CUT = 1.0;
const MIN_PROFILE_LENGTH_MM = 20;
const DANGER_FEE_THRESHOLD_MM = 100;
const DANGER_FEE_PER_PIECE = 5;

const ProfileEditor: React.FC<ProfileEditorProps> = ({ language, product, initialItem, onAddBatchToCart, onUpdateItem, draftProfiles, setDraftProfiles }) => {
  const t = TRANSLATIONS[language];
  const currency = getCurrency(language);
  const navigate = useNavigate();
  
  const initialConfig = initialItem?.config as ProfileConfig | undefined;

  const [variantId, setVariantId] = useState<string>(initialConfig?.variantId || '2020');
  const [finish, setFinish] = useState<ProfileFinish>(initialConfig?.finish || 'oxidized');
  const [colorId, setColorId] = useState<string>(initialConfig?.colorId || 'natural');
  const [length, setLength] = useState<number>(initialConfig?.length || 1000);
  const [tapping, setTapping] = useState<TappingConfig>(initialConfig?.tapping || { left: [false, false], right: [false, false] });
  const [holes, setHoles] = useState<DrillHole[]>(initialConfig?.holes || []);
  const [miterCut, setMiterCut] = useState<MiterCutConfig>(initialConfig?.miterCut || { left: { enabled: false, direction: 'up', side: 'AC' }, right: { enabled: false, direction: 'up', side: 'AC' } });
  const [showMiterCut, setShowMiterCut] = useState<boolean>(!!(initialConfig?.miterCut?.left?.enabled || initialConfig?.miterCut?.right?.enabled));
  
  const [selectedSide, setSelectedSide] = useState<ProfileSide>('A');
  const [newHolePos, setNewHolePos] = useState<string>('');
  const [newHoleType, setNewHoleType] = useState<HoleType>('through');
  const [selectedGrooveIndex, setSelectedGrooveIndex] = useState<number>(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileImgError, setProfileImgError] = useState(false);
  const [colorImgError, setColorImgError] = useState(false);

  const selectedVariant = PROFILE_VARIANTS.find(v => v.id === variantId) || PROFILE_VARIANTS[0];
  const selectedColor = PROFILE_COLORS.find(c => c.id === colorId) || PROFILE_COLORS[0];
  const isTooShort = length <= MIN_PROFILE_LENGTH_MM;
  const isDangerous = length > MIN_PROFILE_LENGTH_MM && length <= DANGER_FEE_THRESHOLD_MM;
  const isTooLong = length > selectedColor.maxLength;

  useEffect(() => {
    setHoles(prevHoles => prevHoles.filter(hole => hole.positionMm < length));
  }, [length]);

  useEffect(() => {
    if (variantId.endsWith('R') && (selectedSide === 'C' || selectedSide === 'D')) setSelectedSide('A');
    setSelectedGrooveIndex(0);
    setProfileImgError(false);
  }, [variantId, selectedSide]);

  useEffect(() => {
    setColorImgError(false);
  }, [colorId]);

  useEffect(() => {
    if (finish === 'oxidized') {
      setColorId('natural');
    } else if (colorId === 'natural') {
      setColorId('black');
    }
  }, [finish]);

  const calculateItemUnitPrice = (len: number, currentHoles: DrillHole[], currentTapping: TappingConfig, currentMiterCut?: MiterCutConfig) => {
    const materialPrice = (len / 1000) * selectedVariant.price[finish];
    let holeFee = currentHoles.reduce((acc, h) => acc + (h.type === 'countersunk' ? PRICE_HOLE_COUNTERSUNK : PRICE_HOLE_THROUGH), 0);
    let tappingFee = (currentTapping.left.filter(Boolean).length + currentTapping.right.filter(Boolean).length) * PRICE_TAPPING_PER_END;
    let miterFee = 0;
    if (currentMiterCut) {
      if (currentMiterCut.left.enabled) miterFee += PRICE_MITER_CUT;
      if (currentMiterCut.right.enabled) miterFee += PRICE_MITER_CUT;
    }
    // Danger fee for short profiles (20mm < length <= 100mm)
    const dangerFee = (len > MIN_PROFILE_LENGTH_MM && len <= DANGER_FEE_THRESHOLD_MM) ? DANGER_FEE_PER_PIECE : 0;
    return parseFloat((materialPrice + holeFee + tappingFee + miterFee + dangerFee).toFixed(1));
  };

  const addHole = () => {
    const pos = parseFloat(newHolePos);
    if (!isNaN(pos) && pos >= 0 && pos < length) {
      setHoles([...holes, { id: Math.random().toString(36).substr(2, 9), side: selectedSide, positionMm: pos, type: newHoleType, grooveIndex: selectedGrooveIndex }]);
      setNewHolePos('');
    } else if (pos >= length) {
      alert(t.position + " " + t.maxLengthExceeded);
    }
  };

  const defaultMiterCut: MiterCutConfig = { left: { enabled: false, direction: 'up', side: 'AC' }, right: { enabled: false, direction: 'up', side: 'AC' } };

  const addToBatch = () => {
    if (length <= MIN_PROFILE_LENGTH_MM) { alert(t.minLengthDangerous); return; }
    if (length > selectedColor.maxLength) { alert(t.maxLengthExceeded); return; }
    const sortedHoles = [...holes].sort((a, b) => a.side.localeCompare(b.side) || a.positionMm - b.positionMm);
    // If miter cut toggle is off, pass no miter cut
    const effectiveMiterCut = showMiterCut ? miterCut : defaultMiterCut;
    const unitPrice = calculateItemUnitPrice(length, sortedHoles, tapping, effectiveMiterCut);
    
    const config: ProfileConfig = { length, tapping: JSON.parse(JSON.stringify(tapping)), holes: sortedHoles, variantId, finish, colorId, unitPrice, miterCut: JSON.parse(JSON.stringify(effectiveMiterCut)) };
    
    if (initialItem) {
      onUpdateItem({ ...initialItem, config, totalPrice: parseFloat((unitPrice * initialItem.quantity).toFixed(1)) });
      navigate('/cart');
    } else if (editingId) {
      setDraftProfiles(draftProfiles.map(item => item.id === editingId ? { ...item, config, totalPrice: parseFloat((unitPrice * item.quantity).toFixed(1)) } : item));
      setEditingId(null);
      setHoles([]);
      setTapping({ left: [false, false], right: [false, false] });
      setMiterCut({ ...defaultMiterCut });
      setShowMiterCut(false);
    } else {
      const existingIdx = draftProfiles.findIndex(item => {
        const c = item.config as ProfileConfig;
        return c.length === config.length && c.variantId === config.variantId && c.finish === config.finish && c.colorId === config.colorId && JSON.stringify(c.tapping) === JSON.stringify(config.tapping) && JSON.stringify(c.holes) === JSON.stringify(config.holes) && JSON.stringify(c.miterCut) === JSON.stringify(config.miterCut);
      });

      if (existingIdx > -1) {
        const newList = [...draftProfiles];
        newList[existingIdx].quantity += 1;
        newList[existingIdx].totalPrice = parseFloat((newList[existingIdx].config.unitPrice! * newList[existingIdx].quantity).toFixed(1));
        setDraftProfiles(newList);
      } else {
        setDraftProfiles([...draftProfiles, { id: Math.random().toString(36).substr(2, 9), product, quantity: 1, config, totalPrice: unitPrice }]);
      }
      setHoles([]);
      setTapping({ left: [false, false], right: [false, false] });
      setMiterCut({ ...defaultMiterCut });
      setShowMiterCut(false);
    }
  };

  const handleBatchConfirm = () => {
    const hasTooShortProfile = draftProfiles.some(item => {
      const cfg = item.config as ProfileConfig;
      return cfg.length <= MIN_PROFILE_LENGTH_MM;
    });

    if (hasTooShortProfile) {
      alert(t.minLengthDangerous);
      return;
    }

    onAddBatchToCart(draftProfiles);
    setDraftProfiles([]);
    navigate('/cart');
  };

  const currentUnitPrice = calculateItemUnitPrice(length, holes, tapping, miterCut);
  const getEditorGrooveCount = (vId: string, side: ProfileSide): number => {
    // 2020 N4 (square/round) - all 4 sides sealed
    if ((vId === '2020-N4-SQ' || vId === '2020-N4-RD') ) return 0;
    // 2020 N2 对边 - AC sealed, BD has groove
    if (vId === '2020-N2-OPP' && (side === 'A' || side === 'C')) return 0;
    if (vId === '2020-N2-OPP' && (side === 'B' || side === 'D')) return 1;
    // 1515 N1 - A side sealed
    if (vId === '1515-N1' && side === 'A') return 0;
    // 1515 N2 - A and B sides sealed
    if (vId === '1515-N2' && (side === 'A' || side === 'B')) return 0;
    // 2047 - A side sealed (like 2040-N1-20), B/D have 2 grooves
    if (vId === '2047' && side === 'A') return 0;
    if (vId === '2047' && (side === 'B' || side === 'D')) return 2;
    // 2040-N1-20: A side sealed
    if (vId === '2040-N1-20' && side === 'A') return 0;
    // 2040-N1-40: A has 1 groove, D sealed but uses 2-groove positions for drilling
    if (vId === '2040-N1-40' && side === 'A') return 1;
    if (vId === '2040-N1-40' && side === 'D') return 2;
    // 2060: B/D have 3 grooves
    if (vId === '2060' && (side === 'B' || side === 'D')) return 3;
    // 20100: B/D have 5 grooves
    if (vId === '20100' && (side === 'B' || side === 'D')) return 5;
    // Standard rectangular profiles (2040, 3060, 2040 variants): B/D have 2 grooves
    if (['2040', '3060', '2040-N1-20', '2040-N1-40'].includes(vId) && (side === 'B' || side === 'D')) return 2;
    // N1/N2/N3 rules
    const name = (PROFILE_VARIANTS.find(v => v.id === vId)?.name || '').toLowerCase();
    if (name.includes('n1') && side === 'A') return 0;
    if (name.includes('n2') && (side === 'A' || side === 'B')) return 0;
    if (name.includes('n3') && (side !== 'D')) return 0;
    return 1;
  };
  const grooveCount = getEditorGrooveCount(selectedVariant.id, selectedSide);

  return (
    <div className="space-y-8">
      <div className={`bg-white p-8 rounded-3xl shadow-xl border ${initialItem || editingId ? 'border-blue-400 ring-4 ring-blue-50' : 'border-slate-100'}`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Settings2 className="w-6 h-6 text-blue-600" />
            {initialItem ? 'Update Configuration' : (editingId ? 'Edit Item' : t.configure)}
          </h3>
          {(editingId || initialItem) && (
            <button onClick={() => { setEditingId(null); if (initialItem) navigate('/cart'); }} className="text-sm text-red-500 hover:text-red-700 font-bold flex items-center gap-1"><X className="w-4 h-4" /> {t.cancelEdit}</button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t.model}</label>
            <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none bg-slate-50 font-black text-slate-700">
              {PROFILE_VARIANTS.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t.finish}</label>
            <select value={finish} onChange={(e) => setFinish(e.target.value as ProfileFinish)} className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none bg-slate-50 font-black text-slate-700">
              <option value="oxidized">{t.finishOxidized}</option>
              <option value="electrophoretic">{t.finishElectrophoretic}</option>
              <option value="powder">{t.finishPowder}</option>
            </select>
          </div>
        </div>

        {/* Profile Cross-Section Image + Color Swatch */}
        <div className="mb-8 flex justify-center gap-4 flex-wrap">
          {/* Cross-section diagram */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 inline-flex flex-col items-center gap-2">
            {!profileImgError && (
              <img
                src={`/images/profile_${variantId}.png`}
                alt={`${selectedVariant.name} cross-section`}
                className="max-h-32 md:max-h-48 object-contain"
                onError={() => setProfileImgError(true)}
              />
            )}
            {profileImgError && (
              <div className="text-slate-400 text-xs font-bold text-center p-4 md:p-8">
                📐 {selectedVariant.name} 截面图<br/>
                <span className="text-[10px] text-slate-300">(images/profile_{variantId}.png)</span>
              </div>
            )}
            <span className="text-[10px] text-slate-400 font-bold">{selectedVariant.name} 截面图</span>
          </div>
          {/* Color swatch */}
          {finish !== 'oxidized' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 inline-flex flex-col items-center gap-2">
              {!colorImgError && (
                <img
                  src={`/images/color_${colorId}.png`}
                  alt={`${selectedColor.name[language]}`}
                  className="max-h-32 md:max-h-48 object-contain"
                  onError={() => setColorImgError(true)}
                />
              )}
              {colorImgError && (
                <div className="text-slate-400 text-xs font-bold text-center p-4">
                  🎨 {selectedColor.name[language]}<br/>
                  <span className="text-[10px] text-slate-300">(images/color_{colorId}.png)</span>
                </div>
              )}
              <span className="text-[10px] text-slate-400 font-bold">{selectedColor.name[language]}</span>
            </div>
          )}
        </div>

        {(finish === 'powder' || finish === 'electrophoretic') && (
          <div className="mb-8">
            <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t.color}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {PROFILE_COLORS.filter(c => c.id !== 'natural').map(color => (
                <button
                  key={color.id}
                  onClick={() => setColorId(color.id)}
                  className={`px-3 py-3 rounded-xl border-2 text-[10px] font-black transition-all uppercase tracking-tighter text-center flex flex-col items-center justify-center gap-1 ${
                    colorId === color.id 
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' 
                      : 'border-slate-100 hover:border-slate-200 text-slate-500 bg-white'
                  }`}
                >
                  <span>{color.name[language]}</span>
                  <span className="block opacity-60 text-[8px] font-normal lowercase tracking-normal">max: {color.maxLength}mm</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-8">
            <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t.length} </label>
            <div className="relative">
              <input type="number" min={MIN_PROFILE_LENGTH_MM + 1} value={length} onChange={(e) => setLength(Math.max(0, parseFloat(e.target.value)))} className={`w-full border rounded-xl px-4 py-3 outline-none font-black text-xl ${isTooLong || isTooShort ? 'border-red-300 text-red-600 bg-red-50' : isDangerous ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-slate-200 bg-slate-50'}`} />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-black">MM</div>
            </div>
            {isTooShort && <div className="text-red-600 text-xs mt-2 font-black">{t.minLengthDangerous} (&gt;{MIN_PROFILE_LENGTH_MM}mm)</div>}
            {isDangerous && <div className="text-amber-600 text-xs mt-2 font-black flex items-center gap-1">⚠️ {t.dangerFeeSurcharge}</div>}
            {isTooLong && <div className="text-red-500 text-xs mt-2 font-bold">{t.maxLengthExceeded} ({selectedColor.maxLength}mm)</div>}
        </div>

        <div className="mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
           <h4 className="text-xs font-black text-slate-400 uppercase mb-4 flex items-center gap-2 tracking-widest"><Hammer className="w-4 h-4 text-blue-500"/> {t.holes}</h4>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <div className="col-span-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t.position}</label>
                <input type="number" value={newHolePos} onChange={e => setNewHolePos(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm font-black" />
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t.holeType}</label>
                <select value={newHoleType} onChange={e => setNewHoleType(e.target.value as HoleType)} className="w-full border rounded-xl px-3 py-2 text-sm bg-white font-black">
                  <option value="through">{t.typeThrough}</option>
                  <option value="countersunk">{t.typeCountersunk}</option>
                </select>
              </div>
              
              <button onClick={addHole} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-700 transition-all h-[42px] uppercase">{t.addHole}</button>
           </div>
        </div>
        {grooveCount >= 2 && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t.groove}</label>
                  <select value={selectedGrooveIndex} onChange={e => setSelectedGrooveIndex(parseInt(e.target.value))} className="w-full border rounded px-2 py-1.5 text-sm bg-white">
                    {Array.from({ length: grooveCount }, (_, i) => {
                      const cnOrdinals = ['第一槽', '第二槽', '第三槽', '第四槽', '第五槽'];
                      const jpOrdinals = ['第一溝', '第二溝', '第三溝', '第四溝', '第五溝'];
                      const label = language === 'cn' ? (cnOrdinals[i] || `第${i+1}槽`) : language === 'jp' ? (jpOrdinals[i] || `第${i+1}溝`) : `Groove ${i + 1}`;
                      return <option key={i} value={i}>{label}</option>;
                    })}
                  </select>
                </div>
              )}
        {/* Miter Cut 45° Toggle */}
        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showMiterCut}
              onChange={(e) => {
                setShowMiterCut(e.target.checked);
                if (!e.target.checked) {
                  setMiterCut({ left: { enabled: false, direction: 'up', side: 'AC' }, right: { enabled: false, direction: 'up', side: 'AC' } });
                }
              }}
              className="w-5 h-5 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="text-amber-500 text-lg">◿</span> {t.miterCutToggle}
            </span>
          </label>
        </div>

        {/* Miter Cut 45° Section - conditionally shown */}
        {showMiterCut && (
        <div className="mb-8 bg-amber-50 p-6 rounded-2xl border border-amber-100">
           <h4 className="text-xs font-black text-slate-400 uppercase mb-4 flex items-center gap-2 tracking-widest">
             <span className="text-amber-500 text-lg">◿</span> {t.miterCut} <span className="text-[10px] font-normal text-amber-600 ml-2">({t.miterCutPrice})</span>
           </h4>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left End */}
              <div className="bg-white p-4 rounded-xl border border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase">{t.miterCutLeft}</label>
                  <button
                    onClick={() => setMiterCut(prev => ({ ...prev, left: { ...prev.left, enabled: !prev.left.enabled } }))}
                    className={`w-10 h-6 rounded-full transition-colors ${miterCut.left.enabled ? 'bg-amber-500' : 'bg-slate-200'} relative`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${miterCut.left.enabled ? 'translate-x-4' : 'translate-x-0.5'}`}></span>
                  </button>
                </div>
                {miterCut.left.enabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t.miterCutSide}</label>
                      <select
                        value={miterCut.left.side || 'AC'}
                        onChange={e => setMiterCut(prev => ({ ...prev, left: { ...prev.left, side: e.target.value as MiterCutSide } }))}
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white font-black"
                      >
                        <option value="AC">{t.miterCutSideAC}</option>
                        <option value="BD">{t.miterCutSideBD}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t.miterCutDirection}</label>
                      <select
                        value={miterCut.left.direction}
                        onChange={e => setMiterCut(prev => ({ ...prev, left: { ...prev.left, direction: e.target.value as MiterCutDirection } }))}
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white font-black"
                      >
                        <option value="up">{t.miterCutUp} ◸</option>
                        <option value="down">{t.miterCutDown} ◺</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
              {/* Right End */}
              <div className="bg-white p-4 rounded-xl border border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase">{t.miterCutRight}</label>
                  <button
                    onClick={() => setMiterCut(prev => ({ ...prev, right: { ...prev.right, enabled: !prev.right.enabled } }))}
                    className={`w-10 h-6 rounded-full transition-colors ${miterCut.right.enabled ? 'bg-amber-500' : 'bg-slate-200'} relative`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${miterCut.right.enabled ? 'translate-x-4' : 'translate-x-0.5'}`}></span>
                  </button>
                </div>
                {miterCut.right.enabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t.miterCutSide}</label>
                      <select
                        value={miterCut.right.side || 'AC'}
                        onChange={e => setMiterCut(prev => ({ ...prev, right: { ...prev.right, side: e.target.value as MiterCutSide } }))}
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white font-black"
                      >
                        <option value="AC">{t.miterCutSideAC}</option>
                        <option value="BD">{t.miterCutSideBD}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t.miterCutDirection}</label>
                      <select
                        value={miterCut.right.direction}
                        onChange={e => setMiterCut(prev => ({ ...prev, right: { ...prev.right, direction: e.target.value as MiterCutDirection } }))}
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white font-black"
                      >
                        <option value="up">{t.miterCutUp} ◹</option>
                        <option value="down">{t.miterCutDown} ◿</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
           </div>
        </div>
        )}

        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
             <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{t.previewAndTapping}</span>
             <div className="text-lg font-black text-blue-600">{currency}{currentUnitPrice.toFixed(1)} / pc</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
            <ProfileVisualizer config={{ length, variantId, holes, tapping, finish, colorId, miterCut }} selectedSide={selectedSide} onSideChange={setSelectedSide} interactive={true} tapLabel={t.tapAction} onTapToggle={(s, i) => setTapping(prev => { const n = [...prev[s]]; while (n.length <= i) n.push(false); n[i] = !n[i]; return {...prev, [s]: n}; })} onHoleClick={(id) => setHoles(holes.filter(h => h.id !== id))} onBarClick={(e, l, r) => { const mm = Math.round(((e.clientX - r.left) / r.width) * l); if (grooveCount >= 2) { const relY = (e.clientY - r.top) / r.height; setSelectedGrooveIndex(Math.min(Math.floor(relY * grooveCount), grooveCount - 1)); } if (mm >= 0 && mm < l) setNewHolePos(mm.toString()); }} />
          </div>
        </div>

        <button onClick={addToBatch} disabled={isTooLong || isTooShort} className={`w-full py-5 font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest ${isTooLong || isTooShort ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : (initialItem || editingId ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20' : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10')}`}>
          {initialItem ? 'Save Updates' : (editingId ? t.updateBatchItem : t.addToBatch)}
        </button>
      </div>

      {!initialItem && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
          <h3 className="text-2xl font-black text-slate-800 mb-6">{t.batchList}</h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left">
              <thead className="text-[10px] font-black text-slate-400 uppercase border-b border-slate-50">
                <tr>
                  <th className="py-4 px-4">{t.model} / {t.length}</th>
                  <th className="px-4">{t.color}</th>
                  <th className="px-4">{t.specs}</th>
                  <th className="px-4 text-center">{t.quantity}</th>
                  <th className="px-4">{t.total}</th>
                  <th className="px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {draftProfiles.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-slate-300 italic font-black">{t.emptyProfileList}</td></tr>}
                {draftProfiles.map((item) => {
                    const profileColor = PROFILE_COLORS.find(c => c.id === item.config.colorId);
                    return (
                      <tr key={item.id} className={`group ${item.id === editingId ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'} transition-colors`}>
                        <td className="py-5 px-4"><div className="font-black text-slate-800">{item.config.variantId}</div><div className="text-[10px] text-slate-400 font-black">{item.config.length}mm</div></td>
                        <td className="px-4">
                           <div className="flex items-center gap-2">
                             <span className="w-3 h-3 rounded-full border border-slate-200" style={{ background: item.config.finish === 'oxidized' ? '#e2e8f0' : '#475569' }}></span>
                             <span className="text-[10px] font-black text-slate-600 uppercase">{profileColor?.name[language]}</span>
                           </div>
                        </td>
                        <td className="px-4">
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] font-black px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{item.config.holes.length}H</span>
                            {item.config.tapping.left.some((b:boolean)=>b) && <span className="text-[10px] font-black px-2 py-0.5 bg-red-100 text-red-600 rounded-full">L-TAP</span>}
                            {item.config.tapping.right.some((b:boolean)=>b) && <span className="text-[10px] font-black px-2 py-0.5 bg-red-100 text-red-600 rounded-full">R-TAP</span>}
                            {item.config.miterCut?.left?.enabled && <span className="text-[10px] font-black px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">L-45°({item.config.miterCut.left.side || 'AC'})</span>}
                            {item.config.miterCut?.right?.enabled && <span className="text-[10px] font-black px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">R-45°({item.config.miterCut.right.side || 'AC'})</span>}
                          </div>
                        </td>
                        <td className="px-4 text-center">
                          <input type="number" min="1" value={item.quantity} onChange={(e) => { const q = parseInt(e.target.value) || 1; setDraftProfiles(draftProfiles.map(x => x.id === item.id ? {...x, quantity: q, totalPrice: parseFloat((x.config.unitPrice * q).toFixed(1))} : x)); }} className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-black" />
                        </td>
                        <td className="px-4 font-black text-blue-600">{currency}{item.totalPrice.toFixed(1)}</td>
                        <td className="px-4 text-right">
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingId(item.id); setVariantId(item.config.variantId); setLength(item.config.length); setHoles(item.config.holes); setTapping(item.config.tapping); setFinish(item.config.finish); setColorId(item.config.colorId); const mc = item.config.miterCut || { left: { enabled: false, direction: 'up', side: 'AC' }, right: { enabled: false, direction: 'up', side: 'AC' } }; setMiterCut(mc); setShowMiterCut(!!(mc.left?.enabled || mc.right?.enabled)); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all"><Pencil className="w-4 h-4"/></button>
                            <button onClick={() => setDraftProfiles(draftProfiles.filter(x => x.id !== item.id))} className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl transition-all"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </td>
                      </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
          <button onClick={handleBatchConfirm} disabled={draftProfiles.length === 0 || !!editingId} className={`w-full py-5 rounded-2xl font-black flex items-center justify-center gap-3 transition-all uppercase tracking-widest ${draftProfiles.length > 0 && !editingId ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
            <ShoppingCart className="w-6 h-6" /> {t.addBatchToCart}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileEditor;
