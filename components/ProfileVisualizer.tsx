import React from 'react';
import { DrillHole, ProfileConfig, ProfileSide, TappingConfig } from '../types';
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

  // Helper logic extracted from Editor
  const isRadiusProfile = selectedVariant.id.endsWith('R');
  const availableSides: ProfileSide[] = isRadiusProfile ? ['A', 'B'] : ['A', 'B', 'C', 'D'];
  
  const isRectangular = ['2040', '3060', '4040'].includes(selectedVariant.id) && selectedVariant.id !== '4040'; 
  const isWideFace = isRectangular && (selectedSide === 'B' || selectedSide === 'D');

  const getGrooveCount = (side: ProfileSide): number => {
    const name = selectedVariant.name.toLowerCase();
    if (name.includes('one face') && side === 'A') return 0;
    if (name.includes('two face') && (side === 'A' || side === 'B')) return 0;
    if (name.includes('three face') && (side !== 'D')) return 0;
    if ((selectedVariant.id === '2040' || selectedVariant.id === '3060') && (side === 'B' || side === 'D')) return 2;
    return 1;
  };

  const grooveCount = getGrooveCount(selectedSide);

  const getVisibleHoles = (side: ProfileSide) => {
    const oppositeMap: Record<ProfileSide, ProfileSide> = { 'A': 'C', 'B': 'D', 'C': 'A', 'D': 'B' };
    const opposite = oppositeMap[side];
    if (isRadiusProfile) return holes.filter(h => h.side === side);
    return holes.filter(h => h.side === side || h.side === opposite);
  };

  const visibleHoles = getVisibleHoles(selectedSide);

  // Helper to render tap indicator
  const renderTapIndicator = (side: 'left' | 'right', index: number, topPct: string) => {
    // Check if this specific hole is tapped
    const isTapped = tapping[side][index];

    return (
      <div 
           key={`${side}-${index}`}
           className={`absolute ${side === 'left' ? 'left-2' : 'right-2'} -translate-y-1/2 flex flex-col items-center ${interactive ? 'cursor-pointer hover:scale-110' : ''} transition-transform ${
             isTapped ? 'opacity-100' : 'opacity-20'
           }`}
           style={{ top: topPct }}
           onClick={(e) => {
             e.stopPropagation();
             interactive && onTapToggle?.(side, index);
           }}
        >
           <span className="text-[10px] text-red-600 font-bold mb-0.5">{tapLabel}</span>
           <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
             isTapped ? 'border-red-500 bg-red-100' : 'border-slate-300 bg-white'
           }`}>
              <span className="text-red-500 text-[10px] font-bold">{side === 'left' ? '→' : '←'}</span>
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
        className={`relative w-full px-8 bg-slate-50 border border-slate-200 rounded flex items-center justify-center select-none transition-all duration-300 ${isWideFace ? 'h-32' : 'h-24'}`}
      >
        {/* Tapping Indicators */}
        {grooveCount === 1 && (
          <>
            {renderTapIndicator('left', 0, '50%')}
            {renderTapIndicator('right', 0, '50%')}
          </>
        )}
        {grooveCount === 2 && (
          <>
             {/* Left Side */}
             {renderTapIndicator('left', 0, '25%')}
             {renderTapIndicator('left', 1, '75%')}
             {/* Right Side */}
             {renderTapIndicator('right', 0, '25%')}
             {renderTapIndicator('right', 1, '75%')}
          </>
        )}

        {/* The Bar */}
        <div 
          className={`relative w-full bg-gradient-to-b from-slate-200 to-slate-300 border-y border-slate-400 shadow-inner transition-all duration-300 ${isWideFace ? 'h-24' : 'h-12'} ${interactive ? 'cursor-crosshair' : ''}`}
          onClick={(e) => {
             if (interactive && onBarClick) {
                 const rect = e.currentTarget.getBoundingClientRect();
                 onBarClick(e, length, rect);
             }
          }}
        >
          {/* Grooves */}
          {grooveCount === 1 && (
            <div className="absolute top-1/2 left-0 right-0 h-3 -translate-y-1/2 bg-black/10 border-y border-black/5 pointer-events-none"></div>
          )}
          {grooveCount === 2 && (
             <>
               <div className="absolute top-[25%] left-0 right-0 h-3 -translate-y-1/2 bg-black/10 border-y border-black/5 pointer-events-none"></div>
               <div className="absolute top-[75%] left-0 right-0 h-3 -translate-y-1/2 bg-black/10 border-y border-black/5 pointer-events-none"></div>
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
            if (grooveCount === 2) {
              verticalPos = hole.grooveIndex === 1 ? '75%' : '25%';
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
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-slate-600 bg-transparent pointer-events-none" />
                 )}
                 <div 
                   className={`rounded-full border border-white/50 bg-black transition-transform ${interactive ? 'group-hover:scale-125 group-hover:bg-red-500' : ''}`}
                   style={{ width: '8px', height: '8px' }}
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
          <div className="absolute bottom-0 w-full flex justify-between px-1 text-[8px] text-slate-500 font-mono leading-none">
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