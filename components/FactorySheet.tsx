
import React from 'react';
import { CartItem, User, ProductType, ProfileConfig, PlateConfig, Language, ProfileSide, Address } from '../types';
import { TRANSLATIONS, PROFILE_COLORS, SHIPPING_RATES, SHIPPING_RATES_SF, SHIPPING_RATES_AN, PROFILE_WEIGHTS, SHIPPING_METHOD_NAMES } from '../constants';
import type { ShippingMethod } from '../constants';
import ProfileVisualizer from './ProfileVisualizer';

interface FactorySheetProps {
  cart: CartItem[];
  user: User | null;
  language: Language;
  orderRef: string;
  dateStr: string;
  id?: string;
  showPrice?: boolean;
  address?: Address;
  shippingMethod?: string;
  shippingFee?: number;
  overlengthFee?: number;
}

const getCurrency = (lang: Language) => lang === 'cn' ? '￥' : '$';

const FactorySheet: React.FC<FactorySheetProps> = ({ cart, user, language, orderRef, dateStr, id, showPrice = true, address, shippingMethod, shippingFee: passedShippingFee, overlengthFee: passedOverlengthFee }) => {
  const t = TRANSLATIONS[language];
  const currency = getCurrency(language);
 
// Summarize profiles for a sheet: length, model, color, finish, tap, quantity, remarks
  const profileSummary = React.useMemo(() => {
    type Row = { length: string; model: string; color: string; section: string; tap: string; quantity: number; remark: string; key: string; miter: string };
    const map = new Map<string, Row>();

    cart.forEach(item => {
      if (item.product.type !== ProductType.PROFILE) return;

      const cfg = item.config as ProfileConfig;

      const length = `${cfg.length}`;
      const model = `${cfg.variantId}`;
      const colorDef = PROFILE_COLORS.find(c => c.id === cfg.colorId);
      const colorName = colorDef?.name[language] || '';

      const finishLabel = cfg.finish === 'oxidized' ? t.finishOxidized :
                          cfg.finish === 'powder' ? t.finishPowder :
                          cfg.finish === 'electrophoretic' ? t.finishElectrophoretic : cfg.finish;
      const section = `${finishLabel}`.trim();

      // --- UPDATED DETECTION LOGIC START ---

      // 1. Check for Tapping (based on TappingConfig)
      // Determine left/right tap presence and one/both-side flags
      const leftTap = Array.isArray(cfg.tapping?.left) && cfg.tapping.left.some(Boolean);
      const rightTap = Array.isArray(cfg.tapping?.right) && cfg.tapping.right.some(Boolean);
      const bothSideTap = leftTap && rightTap;
      const oneSideTap = (leftTap || rightTap) && !bothSideTap;
      const hasTap = leftTap || rightTap;
      const tapType = bothSideTap ? 'both' : oneSideTap ? 'one' : 'none';

      // 2. Check for Drilling (based on DrillHole[])
      const hasDrill = Array.isArray(cfg.holes) && cfg.holes.length > 0;

      // 3. Determine unique Processing State
      // 'tap' takes precedence (usually implies holes + tapping), 'drill' is just holes, 'raw' is nothing.
      let processingState = 'raw';
      
      if (hasDrill) {
        processingState = 'drill';
      } else if (hasTap) {
        processingState = 'tap';
      }

      // 4. Check for Miter Cut
      const hasMiterLeft = cfg.miterCut?.left?.enabled;
      const hasMiterRight = cfg.miterCut?.right?.enabled;
      const leftMiterSide = cfg.miterCut?.left?.side || 'AC';
      const rightMiterSide = cfg.miterCut?.right?.side || 'AC';
      const leftMiterDir = cfg.miterCut?.left?.direction || 'up';
      const rightMiterDir = cfg.miterCut?.right?.direction || 'up';
      const miterKey = hasMiterLeft && hasMiterRight ? `both-${leftMiterSide}-${leftMiterDir}-${rightMiterSide}-${rightMiterDir}` : hasMiterLeft ? `left-${leftMiterSide}-${leftMiterDir}` : hasMiterRight ? `right-${rightMiterSide}-${rightMiterDir}` : 'none';

      // 5. Create Key
      // This ensures a profile with tapping is stored separately from one without
      const key = [length, model, cfg.colorId, section, processingState, tapType, miterKey].join('||');

      // 6. Create Remark
      const hasMiter = hasMiterLeft || hasMiterRight;
      let remark = '无额外加工';
      if (processingState === 'drill' || hasMiter) {
        remark = '加工见下图';
      }

      const tapLabel = bothSideTap ? '两端攻丝' : oneSideTap ? '一端攻丝' : '无';
      
      // Miter cut label for map key (kept simple)
      let miterLabel = '';
      if (hasMiterLeft && hasMiterRight) miterLabel = '两端斜切45°';
      else if (hasMiterLeft) miterLabel = '左端斜切45°';
      else if (hasMiterRight) miterLabel = '右端斜切45°';

      // --- UPDATED DETECTION LOGIC END ---

      const qty = item.quantity || 0;
      const existing = map.get(key);

      if (existing) {
        existing.quantity += qty;
        if (!existing.remark && remark) existing.remark = remark;
      } else {
        map.set(key, { length, model, color: colorName, section, tap: tapLabel, quantity: qty, remark, key, miter: miterLabel });
      }
    });

    return Array.from(map.values());
  }, [cart, language, t]);

  // Use passed address or fallback to default user address
  const activeAddress = address || user?.addresses.find(a => a.isDefault) || user?.addresses[0];
  const userName = activeAddress?.recipient_name || user?.name || 'Guest User';
  const userPhone = activeAddress?.phone || user?.id || '-';

  const baseTotal = cart.reduce((acc, i) => acc + i.totalPrice, 0);

  // 1. 先计算总重量（如果还没计算的话）
  const calculateTotalWeight = () => {
    let totalWeightKg = 0;
    cart.forEach(item => {
      if (item.product.type === ProductType.PROFILE) {
        const cfg = item.config as ProfileConfig;
        const weightPerM = PROFILE_WEIGHTS[cfg.variantId!] || 0.6;
        totalWeightKg += weightPerM * (cfg.length / 1000) * item.quantity;
      } else {
        totalWeightKg += 1 * item.quantity;
      }
    });
    return totalWeightKg;
  };

  // 2. 运费计算 — use passed-in values if available, otherwise auto-calculate cheapest
  const hasOverlength = cart.some(item => {
    if (item.product.type === ProductType.PROFILE) {
      const cfg = item.config as ProfileConfig;
      return cfg.length > 1400;
    }
    return false;
  });

  const calcForMethod = (method: 'standard' | 'sf' | 'anneng', province: string, weightKg: number) => {
    const olFee = (method === 'standard' || method === 'sf') && hasOverlength ? 20 : 0;
    if (method === 'anneng') {
      const rate = SHIPPING_RATES_AN[province] || { first: 50, next: 3 };
      return weightKg <= 15 ? rate.first : rate.first + Math.ceil(weightKg - 15) * rate.next;
    } else if (method === 'sf') {
      const rate = SHIPPING_RATES_SF[province] || { first: 15, next: 5 };
      const rw = Math.max(1, Math.ceil(weightKg));
      return rate.first + (rw - 1) * rate.next + olFee;
    } else {
      const rate = SHIPPING_RATES[province] || { first: 18, next: 5 };
      const rw = Math.max(1, Math.ceil(weightKg));
      return rate.first + (rw - 1) * rate.next + olFee;
    }
  };

  let shippingFee = 0;
  let shippingLabel = shippingMethod || '';
  if (typeof passedShippingFee === 'number') {
    shippingFee = passedShippingFee;
  } else if (activeAddress) {
    const totalWeightKg = calculateTotalWeight();
    const province = activeAddress.province;
    const stdFee = calcForMethod('standard', province, totalWeightKg);
    const sfFee = calcForMethod('sf', province, totalWeightKg);
    const anFee = calcForMethod('anneng', province, totalWeightKg);
    if (stdFee <= sfFee && stdFee <= anFee) { shippingFee = stdFee; shippingLabel = SHIPPING_METHOD_NAMES.standard[language]; }
    else if (sfFee <= anFee) { shippingFee = sfFee; shippingLabel = SHIPPING_METHOD_NAMES.sf[language]; }
    else { shippingFee = anFee; shippingLabel = SHIPPING_METHOD_NAMES.anneng[language]; }
  }

  const normalizedShippingMethod = (shippingMethod || '').toLowerCase();
  if (!shippingLabel && normalizedShippingMethod in SHIPPING_METHOD_NAMES) {
    shippingLabel = SHIPPING_METHOD_NAMES[normalizedShippingMethod as ShippingMethod][language];
  }

  const finalTotal = baseTotal + shippingFee;

  //const shipRate = activeAddress ? (SHIPPING_RATES[activeAddress.province] || { first: 15, next: 0 }) : { first: 0, next: 0 };
  //const shippingFee = activeAddress ? shipRate.first : 0;
  //const finalTotal = baseTotal + shippingFee;

  return (
    <div id={id} className="bg-white p-10 font-mono text-slate-900 w-[210mm] mx-auto shadow-none box-border border border-slate-100 flex flex-col gap-6">
      {/* Header */}
      <div className="border-b-4 border-slate-900 pb-6 flex justify-between items-end">
        <div className="flex-1">
          <h1 className="text-3xl font-black uppercase tracking-widest mb-3">{t.factorySheet}</h1>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
            <p><span className="font-bold">{t.customer}:</span> {userName}</p>
            <p><span className="font-bold">{t.contact}:</span> {userPhone}</p>
            <p><span className="font-bold">{t.shippingMethodLabel || 'Shipping Method'}:</span> {shippingLabel || '-'}</p>
            {activeAddress && (
              <p className="col-span-2 mt-1 bg-slate-50 p-2 rounded border border-slate-200">
                <span className="font-bold">{t.shippingAddress}:</span> {activeAddress.province} {activeAddress.detail}
              </p>
            )}
          </div>
        </div>
        <div className="text-right ml-4">
          <div className="text-xl font-black text-slate-300 mb-1">#{orderRef}</div>
          <p className="text-xs font-bold">{t.date}: {dateStr}</p>
        </div>
      </div>

      {/* Profiles Summary Spreadsheet (after header, before items) */}
      <div className="bg-slate-50 p-4 rounded border border-slate-200">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.profileSummary || 'Profiles Summary'}</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-white/50 text-left text-xs">
                <th className="p-2 border border-slate-200">长度 (mm)</th>
                <th className="p-2 border border-slate-200">Profile Model</th>
                <th className="p-2 border border-slate-200">Color</th>
                <th className="p-2 border border-slate-200">Finish</th>
                <th className="p-2 border border-slate-200">Tap</th>
                <th className="p-2 border border-slate-200">Quantity</th>
                <th className="p-2 border border-slate-200">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {profileSummary.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-400">—</td></tr>
              ) : (
                <>
                {profileSummary.map((r, i) => (
                  <tr key={r.key + i} className="odd:bg-white even:bg-slate-50">
                    <td className="p-2 border border-slate-100">{r.length}</td>
                    <td className="p-2 border border-slate-100">{r.model}</td>
                    <td className="p-2 border border-slate-100">{r.color}</td>
                    <td className="p-2 border border-slate-100">{r.section}</td>
                    <td className="p-2 border border-slate-100">{r.tap}</td>
                    <td className="p-2 border border-slate-100">{r.quantity}</td>
                    <td className="p-2 border border-slate-100">{r.remark}</td>
                  </tr>
                ))}
                <tr className="bg-white">
                  <td className="p-2 border border-slate-100"></td>
                  <td className="p-2 border border-slate-100"></td>
                  <td className="p-2 border border-slate-100"></td>
                  <td className="p-2 border border-slate-100"></td>
                  <td className="p-2 border border-slate-100 font-bold underline text-left">Total</td>
                  <td className="p-2 border border-slate-100 font-bold underline text-right">
                    {profileSummary.reduce((sum, r) => sum + r.quantity, 0)}
                  </td>
                  <td className="p-2 border border-slate-100"></td>
                </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-10">
        {cart.map((item, idx) => {
           const cfg = item.config as ProfileConfig;
           const colorDef = item.product.type === ProductType.PROFILE ? PROFILE_COLORS.find(c => c.id === cfg.colorId) : null;
           
           // Correctly translate finish to Chinese terms as requested
           const finishLabel = cfg.finish === 'oxidized' ? t.finishOxidized : 
                               cfg.finish === 'powder' ? t.finishPowder : 
                               cfg.finish === 'electrophoretic' ? t.finishElectrophoretic : cfg.finish;

           // Early per-item processing detection: if raw (no drilling/tapping/miter), skip rendering this PROFILE item
           const itemHasTap = !!(cfg.tapping?.left?.some(Boolean) || cfg.tapping?.right?.some(Boolean));
           const itemHasDrill = Array.isArray(cfg.holes) && cfg.holes.length > 0;
           const itemHasMiter = !!(cfg.miterCut?.left?.enabled || cfg.miterCut?.right?.enabled);
           let itemProcessingState: 'raw' | 'tap' | 'drill' | 'miter' = 'raw';
           if (itemHasDrill) itemProcessingState = 'drill';
           else if (itemHasMiter) itemProcessingState = 'miter';
           else if (itemHasTap && ['2040', '3060', '2040-N1-20', '2040-N1-40'].includes(String(cfg.variantId))) itemProcessingState = 'tap';

           if (item.product.type === ProductType.PROFILE && itemProcessingState === 'raw') return null;

           return (
           <div key={idx} className="break-inside-avoid border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-sm">
             <div className="bg-slate-900 text-white px-5 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <span className="bg-white text-slate-900 w-8 h-8 flex items-center justify-center rounded-lg font-black text-xl">{idx + 1}</span>
                   <span className="font-black text-xl tracking-tight">{item.product.name[language]}</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="bg-white/20 px-3 py-1 rounded font-bold uppercase text-xs">{t.quantity}: {item.quantity}</div>
                  {showPrice && <div className="font-black text-xl">{currency}{item.totalPrice.toFixed(1)}</div>}
                </div>
             </div>
             
             <div className="p-6">
               {item.product.type === ProductType.PROFILE ? (
                 <div className="space-y-8">
                    {/* Specs Information */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                       <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">{t.specs}</h4>
                       <div className="grid grid-cols-4 gap-4 text-xs">
                          <div className="flex flex-col"><span className="text-slate-400 mb-1">{t.model}</span><span className="font-black">{cfg.variantId}</span></div>
                          <div className="flex flex-col"><span className="text-slate-400 mb-1">{t.length}</span><span className="font-black">{cfg.length}mm</span></div>
                          <div className="flex flex-col"><span className="text-slate-400 mb-1">{t.color}</span><span className="font-black">{colorDef?.name[language]}</span></div>
                          <div className="flex flex-col"><span className="text-slate-400 mb-1">{t.finish}</span><span className="font-black">{finishLabel}</span></div>
                       </div>
                    </div>

                    {/* All-Sides Visualization */}
                    {(() => {
                      const itemHasTap = !!(cfg.tapping?.left?.some(Boolean) || cfg.tapping?.right?.some(Boolean));
                      const itemHasDrill = Array.isArray(cfg.holes) && cfg.holes.length > 0;
                      const itemHasMiterInner = !!(cfg.miterCut?.left?.enabled || cfg.miterCut?.right?.enabled);
                      let itemProcessingState2: 'raw' | 'tap' | 'drill' | 'miter' = 'raw';
                      if (itemHasDrill) itemProcessingState2 = 'drill';
                      else if (itemHasMiterInner) itemProcessingState2 = 'miter';
                      else if (itemHasTap && ['2040', '3060', '2040-N1-20', '2040-N1-40'].includes(String(cfg.variantId))) itemProcessingState2 = 'tap';

                      // For miter cut, determine which sides to show based on cut face (AC/BD)
                      let sidesToShow: ProfileSide[] = [];
                      if (itemProcessingState2 === 'raw') {
                        sidesToShow = [];
                      } else if (itemProcessingState2 === 'tap') {
                        sidesToShow = ['B'];
                      } else if (itemProcessingState2 === 'drill') {
                        sidesToShow = ['A', 'B', 'C', 'D'];
                      } else if (itemProcessingState2 === 'miter') {
                        // Show sides relevant to each miter cut's face
                        const miterSides = new Set<ProfileSide>();
                        if (cfg.miterCut?.left?.enabled) {
                          const s = cfg.miterCut.left.side || 'AC';
                          if (s === 'AC') { miterSides.add('A'); miterSides.add('C'); }
                          else { miterSides.add('B'); miterSides.add('D'); }
                        }
                        if (cfg.miterCut?.right?.enabled) {
                          const s = cfg.miterCut.right.side || 'AC';
                          if (s === 'AC') { miterSides.add('A'); miterSides.add('C'); }
                          else { miterSides.add('B'); miterSides.add('D'); }
                        }
                        // Deduplicate and order
                        const order: ProfileSide[] = ['A', 'B', 'C', 'D'];
                        sidesToShow = order.filter(s => miterSides.has(s));
                      }

                      // If miter is combined with drill, ensure all sides
                      if (itemHasDrill && itemHasMiterInner) {
                        sidesToShow = ['A', 'B', 'C', 'D'];
                      }

                      if (sidesToShow.length === 0) return null;

                      const previewLabel = itemProcessingState2 === 'drill' ? `${t.preview} (All Sides)` : 
                                           itemProcessingState2 === 'miter' ? `${t.preview} (${t.miterCutLabel || '45° Cut'})` :
                                           `${t.preview} (Side B)`;

                      return (
                        <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">{previewLabel}</h4>
                          <div className="grid grid-cols-1 gap-4">
                            {sidesToShow.map(side => (
                              <div key={side} className="flex gap-4 items-center">
                                <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-xl">{side}</div>
                                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                  <ProfileVisualizer config={cfg} selectedSide={side} onSideChange={() => {}} interactive={false} tapLabel={t.tapAction} showSideSelector={false} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Miter Cut Details */}
                    {(cfg.miterCut?.left?.enabled || cfg.miterCut?.right?.enabled) && (
                      <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                        <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="text-amber-500 text-lg">◿</span> {t.miterCutLabel || '45° Cut'}
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {cfg.miterCut?.left?.enabled && (
                            <div className="bg-white p-3 rounded-lg border border-amber-100">
                              <span className="text-slate-400 text-[10px] font-black uppercase">{t.miterCutLeft}</span>
                              <div className="font-black text-amber-800 mt-1">
                                {(cfg.miterCut.left.side || 'AC')} · {cfg.miterCut.left.direction === 'up' ? t.miterCutUp : t.miterCutDown}
                              </div>
                            </div>
                          )}
                          {cfg.miterCut?.right?.enabled && (
                            <div className="bg-white p-3 rounded-lg border border-amber-100">
                              <span className="text-slate-400 text-[10px] font-black uppercase">{t.miterCutRight}</span>
                              <div className="font-black text-amber-800 mt-1">
                                {(cfg.miterCut.right.side || 'AC')} · {cfg.miterCut.right.direction === 'up' ? t.miterCutUp : t.miterCutDown}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Drilling Spreadsheet */}
                    {cfg.holes.length > 0 ? (
                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex justify-between">
                           <span>{t.drillingInstr}</span>
                           <span className="text-[10px] lowercase text-slate-300 font-normal">total: {cfg.holes.length} holes</span>
                        </h4>
                        <table className="w-full text-left text-[10px] border-collapse">
                           <thead>
                             <tr className="bg-slate-100">
                               <th className="p-2 border border-slate-200">#</th>
                               <th className="p-2 border border-slate-200">{t.side}</th>
                               <th className="p-2 border border-slate-200">{t.position} (mm)</th>
                               <th className="p-2 border border-slate-200">{t.holeType}</th>
                               <th className="p-2 border border-slate-200">{t.groove}</th>
                             </tr>
                           </thead>
                           <tbody>
                             {cfg.holes.map((hole, hIdx) => (
                               <tr key={hole.id} className="hover:bg-slate-50">
                                 <td className="p-2 border border-slate-100 font-bold">{hIdx + 1}</td>
                                 <td className="p-2 border border-slate-100 font-black">{hole.side}</td>
                                 <td className="p-2 border border-slate-100 font-black text-blue-600">{hole.positionMm}</td>
                                 <td className="p-2 border border-slate-100">{hole.type === 'countersunk' ? t.typeCountersunk : t.typeThrough}</td>
                                 <td className="p-2 border border-slate-100">{hole.grooveIndex === 1 ? t.abbrBottom : t.abbrTop}</td>
                               </tr>
                             ))}
                           </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic bg-slate-50 p-2 rounded border border-dashed border-slate-200 text-center uppercase tracking-widest">
                        {t.noDrilling}
                      </div>
                    )}
                 </div>
               ) : <div className="text-sm font-bold p-10 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl uppercase tracking-widest">{t.dimensions}: {(item.config as PlateConfig).items.length} pcs total</div>}
             </div>
           </div>
        )})}
      </div>

      {/* Totals */}
      {showPrice && (
        <div className="mt-12 border-t-4 border-slate-900 pt-8 flex justify-end">
           <div className="w-80 space-y-3 text-right">
              <div className="flex justify-between text-slate-500 text-xs"><span>{t.total}:</span><span className="font-bold text-slate-800">{currency}{baseTotal.toFixed(1)}</span></div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>{t.shippingFee}{shippingLabel ? ` (${shippingLabel})` : ''}:</span>
                <span className="font-bold text-slate-800">{currency}{shippingFee.toFixed(1)}</span>
              </div>
              {(passedOverlengthFee ?? 0) > 0 && (
                <div className="flex justify-between text-amber-600 text-xs"><span>{t.overlengthFee} (含):</span><span className="font-bold">+{currency}{passedOverlengthFee!.toFixed(0)}</span></div>
              )}
              <div className="flex justify-between text-3xl font-black pt-4 border-t border-slate-100 text-blue-600">
                <span>{t.total}</span>
                <span>{currency}{finalTotal.toFixed(1)}</span>
              </div>
           </div>
        </div>
      )}

      {/* Payment QR Codes */}
      {showPrice && (
        <div className="break-inside-avoid border-t-2 border-slate-200 pt-6 mt-8">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">付款方式</h4>
          <div className="grid grid-cols-3 gap-4">
            {/* Alipay */}
            <div className="text-center space-y-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
              <div className="text-xs font-bold text-slate-900">{t.alipayPayment}</div>
              <div className="flex justify-center">
                <img src="images/alipay-qr.jpg" alt="Alipay" className="w-24 h-24 rounded-lg border border-slate-200" />
              </div>
              <p className="text-[9px] text-slate-500 leading-tight">{t.alipayInstructions}</p>
              <p className="text-[9px] font-bold text-slate-700">上海暖橙黄信息科技有限公司</p>
            </div>
            {/* WeChat Pay */}
            <div className="text-center space-y-2 p-3 bg-green-50 rounded-xl border border-green-200">
              <div className="text-xs font-bold text-slate-900">{t.wechatPayment}</div>
              <div className="flex justify-center">
                <img src="images/wechatpay-qr.png" alt="WeChat Pay" className="w-24 h-24 rounded-lg border border-slate-200" />
              </div>
              <p className="text-[9px] text-slate-500 leading-tight">{t.wechatInstructions}</p>
              <p className="text-[9px] font-bold text-slate-700">{t.wechatPhone}</p>
            </div>
            {/* After-sales WeChat */}
            <div className="text-center space-y-2 p-3 bg-green-50 rounded-xl border border-green-200">
              <div className="text-xs font-bold text-slate-900">{t.afterpay}</div>
              <div className="flex justify-center">
                <img src="images/wechat-qr.jpg" alt="WeChat" className="w-24 h-24 rounded-lg border border-slate-200" />
              </div>
              <p className="text-[9px] text-slate-500 leading-tight">{t.afterpayinstructions}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-auto pt-16 text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
         {t.generatedBy} · {dateStr} · {orderRef}
      </div>
    </div>
  );
};

export default FactorySheet;
