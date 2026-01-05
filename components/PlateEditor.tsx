
import React, { useState, useEffect, useMemo } from 'react';
import { PlateConfig, Rect, Language } from '../types';
import { TRANSLATIONS, PLATE_HEIGHT, PLATE_WIDTH, PLATE_MARGIN, ITEM_GAP } from '../constants';
import { MockService } from '../services/mockStore';
import { Plus, Trash2, Box, Info } from 'lucide-react';

interface PlateEditorProps {
  language: Language;
  onSave: (config: PlateConfig) => void;
}

const PlateEditor: React.FC<PlateEditorProps> = ({ language, onSave }) => {
  const t = TRANSLATIONS[language];
  const [existingItems, setExistingItems] = useState<Rect[]>([]);
  const [userItems, setUserItems] = useState<Rect[]>([]);
  
  const [width, setWidth] = useState<number>(500);
  const [height, setHeight] = useState<number>(500);

  useEffect(() => {
    // Load the "Shared Pool" state
    const pool = MockService.getPoolState();
    setExistingItems(pool);
  }, []);

  // Simple automated placement logic for demo purposes
  // In a real app, this would be a complex bin-packing algorithm or drag-and-drop
  const placeItem = (w: number, h: number, existing: Rect[]): { x: number, y: number } | null => {
    // Brute force check grid (coarse grain for performance)
    const step = 50; 
    
    // Bounds
    const maxX = PLATE_WIDTH - PLATE_MARGIN - w;
    const maxY = PLATE_HEIGHT - PLATE_MARGIN - h;

    for (let y = PLATE_MARGIN; y <= maxY; y += step) {
      for (let x = PLATE_MARGIN; x <= maxX; x += step) {
        // Check collision with all existing + user items
        let collision = false;
        const allItems = [...existing, ...userItems];
        
        for (const item of allItems) {
           const gap = ITEM_GAP;
           // Check overlapping including gap
           if (x < (item.x! + item.width + gap) && 
               (x + w + gap) > item.x! &&
               y < (item.y! + item.height + gap) &&
               (y + h + gap) > item.y!) {
             collision = true;
             break;
           }
        }
        
        if (!collision) return { x, y };
      }
    }
    return null;
  };

  const addItem = () => {
    const pos = placeItem(width, height, existingItems);
    if (pos) {
      const newItem: Rect = {
        id: Math.random().toString(36).substr(2, 9),
        width,
        height,
        x: pos.x,
        y: pos.y,
        color: '#3b82f6' // Blue for user items
      };
      setUserItems([...userItems, newItem]);
    } else {
      alert("No space left on the current plate for this size! Try smaller dimensions.");
    }
  };

  const removeUserItem = (id: string) => {
    setUserItems(userItems.filter(i => i.id !== id));
  };

  useEffect(() => {
    onSave({ items: userItems });
  }, [userItems, onSave]);

  const totalArea = PLATE_WIDTH * PLATE_HEIGHT;
  const occupiedArea = [...existingItems, ...userItems].reduce((acc, item) => acc + (item.width * item.height), 0);
  const utilization = (occupiedArea / totalArea) * 100;
  const isDiscount = utilization > 80;

  // SVG Scaling
  const viewBox = `0 0 ${PLATE_WIDTH} ${PLATE_HEIGHT}`;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
           <h3 className="text-xl font-bold text-slate-800">{t.configure} - {t.plateSize} 2500x1250mm</h3>
           <p className="text-sm text-slate-500 mt-1">{t.discount}: <span className={isDiscount ? 'text-green-600 font-bold' : 'text-slate-400'}>{isDiscount ? t.discountActive : t.discountInactive}</span></p>
        </div>
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <div className="text-right">
             <div className="text-xs text-slate-500">{t.utilization}</div>
             <div className="text-2xl font-bold text-slate-800">{utilization.toFixed(1)}%</div>
          </div>
          <div className="w-16 h-16 relative">
             <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <path className="text-slate-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                <path className={isDiscount ? "text-green-500" : "text-blue-500"} strokeDasharray={`${utilization}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
             </svg>
          </div>
        </div>
      </div>

      {/* Input Controls */}
      <div className="bg-slate-50 p-4 rounded-lg mb-6 flex flex-wrap gap-4 items-end border border-slate-200">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t.width} (mm)</label>
          <input 
            type="number" 
            value={width} 
            onChange={e => setWidth(Number(e.target.value))}
            className="w-32 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
            min={100} max={2400}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t.height} (mm)</label>
          <input 
            type="number" 
            value={height} 
            onChange={e => setHeight(Number(e.target.value))}
            className="w-32 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
            min={100} max={1200}
          />
        </div>
        <button 
          onClick={addItem}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> {t.addPiece}
        </button>
      </div>

      {/* The Visual Plate */}
      <div className="w-full overflow-hidden border-4 border-slate-800 rounded-lg bg-slate-100 mb-6 relative shadow-inner">
        <div className="absolute top-2 left-2 z-10 bg-white/80 backdrop-blur px-2 py-1 rounded text-xs font-mono border border-slate-300">
          Batch Layout Preview
        </div>
        <svg viewBox={viewBox} className="w-full h-auto bg-white">
          {/* Grid lines (optional visual aid) */}
          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1"/>
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Existing Items */}
          {existingItems.map(item => (
            <g key={item.id}>
              <rect
                x={item.x}
                y={item.y}
                width={item.width}
                height={item.height}
                fill={item.color}
                stroke="#4b5563"
                strokeWidth="2"
                className="opacity-60"
              />
              <text x={(item.x || 0) + item.width/2} y={(item.y || 0) + item.height/2} textAnchor="middle" fill="#fff" fontSize="40" className="pointer-events-none font-bold opacity-50">
                BUSY
              </text>
            </g>
          ))}

          {/* User Items */}
          {userItems.map(item => (
            <g key={item.id}>
              <rect
                x={item.x}
                y={item.y}
                width={item.width}
                height={item.height}
                fill={item.color}
                stroke="#1e40af"
                strokeWidth="4"
              />
               <text x={(item.x || 0) + item.width/2} y={(item.y || 0) + item.height/2} textAnchor="middle" fill="#fff" fontSize="50" className="pointer-events-none font-bold drop-shadow-md">
                {item.width}x{item.height}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* User Item List */}
      <div className="space-y-2">
        <h4 className="font-semibold text-slate-700">{t.myPieces}</h4>
        {userItems.length === 0 && <p className="text-sm text-slate-400 italic">No pieces added.</p>}
        {userItems.map(item => (
          <div key={item.id} className="flex justify-between items-center bg-blue-50 p-3 rounded border border-blue-100">
            <div className="flex items-center gap-3">
              <Box className="w-4 h-4 text-blue-500" />
              <span className="font-mono text-slate-700">{item.width}mm x {item.height}mm</span>
            </div>
            <button onClick={() => removeUserItem(item.id)} className="text-red-500 hover:text-red-700 p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlateEditor;
