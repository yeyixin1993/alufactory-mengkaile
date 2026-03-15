import React from 'react';
import { DrillHole, ProfileConfig, ProfileSide, TappingConfig, MiterCutConfig } from '../types';
import { PROFILE_VARIANTS } from '../constants';

interface ProfileVisualizerProps {
  config: ProfileConfig;
  selectedSide: ProfileSide;
  onSideChange: (side: ProfileSide) => void;
  // Interaction callbacks (optional, if provided the component is interactive)
  onTapToggle?: (side: 'left' | 'right', holeIndex: number) => void;
  onBarClick?: (e: React.MouseEvent<HTMLDivElement>, length: number, rect: DOMRect) => void;
  onHoleClick?: (holeId: string) => void;
  interactive?: boolean;
  tapLabel: string; // New prop for localized label
  showSideSelector?: boolean;
}

/**
 * Renders a 45° miter-cut triangle using an HTML <canvas> element.
 * Canvas is used instead of SVG because html2canvas (used for PDF/PNG/JPG export)
 * does not reliably render inline SVG elements.
 */
const MiterCutCanvas: React.FC<{
  side: 'left' | 'right';
  direction: 'up' | 'down';
  size: number;
  label: string;
}> = ({ side, direction, size, label }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = 2;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    // Draw filled triangle
    ctx.beginPath();
    if (side === 'left') {
      if (direction === 'up') {
        ctx.moveTo(0, 0); ctx.lineTo(size, 0); ctx.lineTo(0, size);
      } else {
        ctx.moveTo(0, size); ctx.lineTo(size, size); ctx.lineTo(0, 0);
      }
    } else {
      if (direction === 'up') {
        ctx.moveTo(size, 0); ctx.lineTo(0, 0); ctx.lineTo(size, size);
      } else {
        ctx.moveTo(size, size); ctx.lineTo(0, size); ctx.lineTo(size, 0);
      }
    }
    ctx.closePath();
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw rotated label
    const fontSize = Math.max(7, size * 0.15);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = '#d97706';
    ctx.save();
    if (side === 'left') {
      if (direction === 'up') {
        ctx.translate(size * 0.15, size * 0.3);
        ctx.rotate(-Math.PI / 4);
      } else {
        ctx.translate(size * 0.15, size * 0.78);
        ctx.rotate(Math.PI / 4);
      }
    } else {
      if (direction === 'up') {
        ctx.translate(size * 0.5, size * 0.3);
        ctx.rotate(Math.PI / 4);
      } else {
        ctx.translate(size * 0.5, size * 0.78);
        ctx.rotate(-Math.PI / 4);
      }
    }
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }, [side, direction, size, label]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        ...(side === 'left' ? { left: 0 } : { right: 0 }),
        top: 0,
        width: `${size}px`,
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
};

const ProfileVisualizer: React.FC<ProfileVisualizerProps> = ({
  config,
  selectedSide,
  onSideChange,
  onTapToggle,
  onBarClick,
  onHoleClick,
  interactive = false,
  tapLabel,
  showSideSelector = true
}) => {
  const { length, variantId, holes, tapping } = config;
  const selectedVariant = PROFILE_VARIANTS.find(v => v.id === variantId) || PROFILE_VARIANTS[0];

  const tapDisabledVariants = ['2040', '3060', '2040-N1-20', '2040-N1-40', '2047', '2060', '20100'];

  // Helper logic extracted from Editor
  const isRadiusProfile = selectedVariant.id.endsWith('R');
  const availableSides: ProfileSide[] = isRadiusProfile ? ['A', 'B'] : ['A', 'B', 'C', 'D'];
  
  const isRectangular = ['2040', '3060', '2040-N1-20', '2040-N1-40', '2047', '2060', '20100'].includes(selectedVariant.id);
  const isWideFace = isRectangular && (selectedSide === 'B' || selectedSide === 'D');
  // Even wider faces for 2060 and 20100
  const isExtraWideFace = ['2060', '20100'].includes(selectedVariant.id) && (selectedSide === 'B' || selectedSide === 'D');

  const getGrooveCount = (side: ProfileSide): number => {
    const id = selectedVariant.id;
    const name = selectedVariant.name.toLowerCase();

    // 2020 N4 (square/round) - all 4 sides sealed, no grooves
    if ((id === '2020-N4-SQ' || id === '2020-N4-RD')) return 0;

    // 2020 N2 对边 - AC sealed, BD has groove
    if (id === '2020-N2-OPP' && (side === 'A' || side === 'C')) return 0;
    if (id === '2020-N2-OPP' && (side === 'B' || side === 'D')) return 1;

    // 1515 N1 - A side sealed (like 2020 N1)
    if (id === '1515-N1' && side === 'A') return 0;

    // 1515 N2 - A and B sides sealed (like 2020 N2)
    if (id === '1515-N2' && (side === 'A' || side === 'B')) return 0;

    // 2047 - A side sealed (like 2040-N1-20), B/D have 2 grooves
    if (id === '2047' && side === 'A') return 0;
    if (id === '2047' && (side === 'B' || side === 'D')) return 2;

    // Specific exceptions for 2040 N1 variants
    if (id === '2040-N1-20' && side === 'A') return 0;
    if (id === '2040-N1-40' && side === 'A') return 1;
    // 2040-N1-40 D side: sealed but uses 2-groove positions for drilling
    if (id === '2040-N1-40' && side === 'D') return 2;

    // 2060: B/D have 3 grooves
    if (id === '2060' && (side === 'B' || side === 'D')) return 3;

    // 20100: B/D have 5 grooves
    if (id === '20100' && (side === 'B' || side === 'D')) return 5;

    // Legacy name-based rules (2020 / 3030 and other variants that include N1/N2/N3)
    if (name.includes('n1') && side === 'A') return 0;
    if (name.includes('n2') && (side === 'A' || side === 'B')) return 0;
    if (name.includes('n3') && (side !== 'D')) return 0;

    // Two-groove rectangular profiles (include the 2040 N1 variants here so they still render two grooves when applicable)
    if (['2040', '3060', '2040-N1-20', '2040-N1-40'].includes(id) && (side === 'B' || side === 'D')) return 2;

    return 1;
  };

  const grooveCount = getGrooveCount(selectedSide);

  // Visual groove count: how many groove lines to actually draw.
  // For sealed faces that still allow drill positioning (e.g. 2040-N1-40 D), visual = 0.
  const getVisualGrooveCount = (side: ProfileSide): number => {
    const id = selectedVariant.id;
    // 2040-N1-40 D side is sealed (no visible groove) but uses 2 drill positions
    if (id === '2040-N1-40' && side === 'D') return 0;
    return getGrooveCount(side);
  };
  const visualGrooveCount = getVisualGrooveCount(selectedSide);

  const getVisibleHoles = (side: ProfileSide) => {
    const oppositeMap: Record<ProfileSide, ProfileSide> = { 'A': 'C', 'B': 'D', 'C': 'A', 'D': 'B' };
    const opposite = oppositeMap[side];
    if (isRadiusProfile) return holes.filter(h => h.side === side);
    return holes.filter(h => h.side === side || h.side === opposite);
  };

  const visibleHoles = getVisibleHoles(selectedSide);

  // Helper to render tap indicator
  const renderTapIndicator = (side: 'left' | 'right', index: number, topPct: string) => {
    // Disable taps visually/click behavior for certain variants when A or C is selected
    const disabledForSide = tapDisabledVariants.includes(selectedVariant.id) && (selectedSide === 'A' || selectedSide === 'C');
    const isTapped = tapping[side][index] && !disabledForSide;

    return (
      <div 
           key={`${side}-${index}`}
           className={`absolute ${side === 'left' ? 'left-2' : 'right-2'} -translate-y-1/2 flex flex-col items-center transition-transform ${
             interactive && !disabledForSide ? 'cursor-pointer hover:scale-110' : 'cursor-default'
           } ${isTapped ? 'opacity-100' : disabledForSide ? 'opacity-40' : 'opacity-20'}`}
           style={{ top: topPct }}
           onClick={(e) => {
             e.stopPropagation();
             if (interactive && !disabledForSide) onTapToggle?.(side, index);
           }}
        >
           <span className={`${disabledForSide ? 'text-slate-400' : 'text-red-600'} text-[10px] font-bold leading-none`}>{tapLabel}</span>
           <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${
             isTapped ? 'border-red-500 bg-red-100' : 'border-slate-300 bg-white'
           }`}>
              <span className={`${disabledForSide ? 'text-slate-400' : 'text-red-500'} text-[10px] font-bold leading-none`}>{side === 'left' ? '→' : '←'}</span>
           </div>
        </div>
    );
  };

  return (
    <div className="w-full">
      {/* Side Selector */}
      {showSideSelector && (
        <div className="flex flex-wrap justify-center gap-1 mb-2">
          {availableSides.map(side => (
            <button
              key={side}
              onClick={() => onSideChange(side)}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                selectedSide === side 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {side}
            </button>
          ))}
        </div>
      )}

      {/* Visual Bar Container - Restored to px-8 for tap indicator visibility */}
      <div 
        className={`relative w-full px-8 bg-slate-50 border border-slate-200 rounded flex items-center justify-center select-none transition-all duration-300 overflow-visible ${isExtraWideFace ? 'h-48' : isWideFace ? 'h-32' : 'h-24'}`}
      >
        {/* Tapping Indicators */}
        {grooveCount === 0 && (
          <>
            {renderTapIndicator('left', 0, '50%')}
            {renderTapIndicator('right', 0, '50%')}
          </>
        )}
        {grooveCount === 1 && (
          <>
            {renderTapIndicator('left', 0, '50%')}
            {renderTapIndicator('right', 0, '50%')}
          </>
        )}
        {grooveCount >= 2 && (
          <>
            {Array.from({ length: grooveCount }, (_, i) => {
              const pct = `${((i + 1) / (grooveCount + 1)) * 100}%`;
              return (
                <React.Fragment key={`tap-${i}`}>
                  {renderTapIndicator('left', i, pct)}
                  {renderTapIndicator('right', i, pct)}
                </React.Fragment>
              );
            })}
          </>
        )}

        {/* The Bar */}
        <div 
          className={`relative w-full bg-gradient-to-b from-slate-200 to-slate-300 border-y border-slate-400 shadow-inner transition-all duration-300 overflow-visible ${isExtraWideFace ? 'h-40' : isWideFace ? 'h-24' : 'h-12'} ${interactive ? 'cursor-crosshair' : ''}`}
          style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
          onClick={(e) => {
             if (interactive && onBarClick) {
                 const rect = e.currentTarget.getBoundingClientRect();
                 onBarClick(e, length, rect);
             }
          }}
        >
          {/* 45° Miter Cut Overlays
               AC-side cut: visible as triangle on faces A and C (direction flips on C).
               BD-side cut: visible as triangle on faces B and D (direction flips on D).
               When viewing a face not in the cut's plane, no triangle is shown. */}
          {config.miterCut?.left?.enabled && (() => {
            const cutSide = config.miterCut!.left.side || 'AC';
            let dir: 'up' | 'down' | null = null;
            if (cutSide === 'AC') {
              if (selectedSide === 'A') dir = config.miterCut!.left.direction;
              else if (selectedSide === 'C') dir = config.miterCut!.left.direction === 'up' ? 'down' : 'up';
            } else {
              if (selectedSide === 'B') dir = config.miterCut!.left.direction;
              else if (selectedSide === 'D') dir = config.miterCut!.left.direction === 'up' ? 'down' : 'up';
            }
            if (!dir) return null;
            const h = isExtraWideFace ? 160 : isWideFace ? 96 : 48;
            const label = `45°${cutSide}`;
            return <MiterCutCanvas side="left" direction={dir} size={h} label={label} />;
          })()}
          {config.miterCut?.right?.enabled && (() => {
            const cutSide = config.miterCut!.right.side || 'AC';
            let dir: 'up' | 'down' | null = null;
            if (cutSide === 'AC') {
              if (selectedSide === 'A') dir = config.miterCut!.right.direction;
              else if (selectedSide === 'C') dir = config.miterCut!.right.direction === 'up' ? 'down' : 'up';
            } else {
              if (selectedSide === 'B') dir = config.miterCut!.right.direction;
              else if (selectedSide === 'D') dir = config.miterCut!.right.direction === 'up' ? 'down' : 'up';
            }
            if (!dir) return null;
            const h = isExtraWideFace ? 160 : isWideFace ? 96 : 48;
            const label = `45°${cutSide}`;
            return <MiterCutCanvas side="right" direction={dir} size={h} label={label} />;
          })()}
          {/* Grooves (visual only - sealed faces with drill positions don't render lines) */}
          {visualGrooveCount === 1 && (
            <div className="absolute top-1/2 left-0 right-0 h-3 -translate-y-1/2 bg-black/10 border-y border-black/5 pointer-events-none"></div>
          )}
          {visualGrooveCount >= 2 && (
             <>
               {Array.from({ length: visualGrooveCount }, (_, i) => {
                 const pct = ((i + 1) / (visualGrooveCount + 1)) * 100;
                 return (
                   <div key={`groove-${i}`} className="absolute left-0 right-0 h-3 -translate-y-1/2 bg-black/10 border-y border-black/5 pointer-events-none" style={{ top: `${pct}%` }}></div>
                 );
               })}
             </>
          )}

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 overflow-hidden">
             <span className="text-2xl font-black text-slate-500 whitespace-nowrap">{selectedVariant.name}</span>
          </div>

          {/* Holes */}
          {visibleHoles.map(hole => {
            const isExit = hole.side !== selectedSide;
            const isCountersunkEntry = hole.type === 'countersunk' && !isExit;
            
            let verticalPos = '50%';
            if (grooveCount >= 2) {
              const gi = hole.grooveIndex ?? 0;
              verticalPos = `${((gi + 1) / (grooveCount + 1)) * 100}%`;
            }

            return (
              <div
                key={hole.id}
                className={`absolute -translate-y-1/2 transform -translate-x-1/2 group ${interactive ? 'cursor-pointer' : ''}`}
                style={{ 
                  left: `${(hole.positionMm / length) * 100}%`,
                  top: verticalPos
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  interactive && onHoleClick?.(hole.id);
                }}
              >
                 {isCountersunkEntry && (
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full pointer-events-none" style={{ border: '1px solid #475569', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties} />
                 )}
                 <div 
                   className={`rounded-full border border-white/50 transition-transform ${interactive ? 'group-hover:scale-125 group-hover:bg-red-500' : ''}`}
                   style={{ width: '8px', height: '8px', backgroundColor: '#000', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
                 />
                 
                 {interactive && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none">
                        {hole.positionMm}mm {hole.type === 'countersunk' ? '(CS)' : '(T)'} {isExit ? '[Exit]' : ''}
                    </div>
                 )}
              </div>
            );
          })}

          {/* Ruler */}
          <div className="absolute bottom-0 w-full flex justify-between items-end px-1 text-[8px] text-slate-500 font-mono leading-none pb-0.5">
            <span>0</span>
            <span>{Math.round(length / 2)}</span>
            <span>{length}mm</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileVisualizer;