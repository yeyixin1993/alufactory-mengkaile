import React, { useEffect, useMemo, useState } from 'react';
import { Product, ProductType, SharedBoardPiece } from '../types';
import { ApiService } from '../services/apiService';

interface SharedBoardEditorProps {
  product: Product;
  onAddToCart: (item: any) => void;
}

type BoardSettings = {
  board_width_mm: number;
  board_height_mm: number;
  min_gap_mm: number;
  group_factor: number;
  thickness_options: number[];
  thickness_price_map: Record<string, number>;
};

const defaultSettingsByType: Record<ProductType.PEGBOARD | ProductType.CABINET_DOOR, BoardSettings> = {
  [ProductType.PEGBOARD]: {
    board_width_mm: 2450,
    board_height_mm: 1240,
    min_gap_mm: 5,
    group_factor: 1,
    thickness_options: [1, 2, 3, 4, 5],
    thickness_price_map: { '1': 780, '2': 1080, '3': 1380, '4': 1680, '5': 1980 },
  },
  [ProductType.CABINET_DOOR]: {
    board_width_mm: 2450,
    board_height_mm: 1240,
    min_gap_mm: 5,
    group_factor: 1,
    thickness_options: [2],
    thickness_price_map: { '2': 700 },
  },
};

const SharedBoardEditor: React.FC<SharedBoardEditorProps> = ({ product, onAddToCart }) => {
  const productType = product.type as ProductType.PEGBOARD | ProductType.CABINET_DOOR;
  const [settings, setSettings] = useState<BoardSettings>(defaultSettingsByType[productType]);
  const [reserved, setReserved] = useState<any[]>([]);
  const [pieces, setPieces] = useState<SharedBoardPiece[]>([]);

  const [width, setWidth] = useState(900);
  const [height, setHeight] = useState(800);
  const [thickness, setThickness] = useState(defaultSettingsByType[productType].thickness_options[0]);

  useEffect(() => {
    ApiService.getSharedBoardSettings(productType)
      .then((s: any) => {
        if (s) {
          setSettings(s);
          if (Array.isArray(s.thickness_options) && s.thickness_options.length > 0) {
            setThickness(s.thickness_options[0]);
          }
        }
      })
      .catch(() => setSettings(defaultSettingsByType[productType]));

    ApiService.getSharedBoardReservations(productType)
      .then((data: any) => setReserved(data.reservations || []))
      .catch(() => setReserved([]));
  }, [productType]);

  const boardWidth = settings.board_width_mm;
  const boardHeight = settings.board_height_mm;
  const minGap = settings.min_gap_mm;

  const allRects = useMemo(() => {
    const busy = reserved.map((r: any) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
    const mine = pieces.map((p) => ({ x: p.x!, y: p.y!, width: p.width, height: p.height }));
    return [...busy, ...mine];
  }, [reserved, pieces]);

  const areaM2 = (w: number, h: number) => (w / 1000) * (h / 1000);

  const placeRect = (w: number, h: number) => {
    const step = 5;
    const maxX = boardWidth - w;
    const maxY = boardHeight - h;

    for (let y = 0; y <= maxY; y += step) {
      for (let x = 0; x <= maxX; x += step) {
        const collides = allRects.some((r) => {
          return (
            x < r.x + r.width + minGap &&
            x + w + minGap > r.x &&
            y < r.y + r.height + minGap &&
            y + h + minGap > r.y
          );
        });
        if (!collides) return { x, y };
      }
    }
    return null;
  };

  const addPiece = () => {
    if (width <= 0 || height <= 0) return;
    if (width > boardWidth || height > boardHeight) {
      alert('尺寸超过大板尺寸');
      return;
    }

    const pos = placeRect(width, height);
    if (!pos) {
      alert('当前大板无可用空间（或未满足最小间隔 5mm 规则）');
      return;
    }

    const unitPricePerM2 = Number(settings.thickness_price_map[String(thickness)] || 0);
    const price = Number((areaM2(width, height) * unitPricePerM2 * settings.group_factor).toFixed(2));

    const piece: SharedBoardPiece = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      x: pos.x,
      y: pos.y,
      width,
      height,
      color: '#3b82f6',
      thicknessMm: thickness,
      areaM2: Number(areaM2(width, height).toFixed(4)),
      unitPricePerM2,
      price,
    };

    setPieces((prev) => [...prev, piece]);
  };

  const removePiece = (id: string) => setPieces((prev) => prev.filter((p) => p.id !== id));

  const totalPrice = useMemo(() => Number(pieces.reduce((s, p) => s + p.price, 0).toFixed(2)), [pieces]);

  const addToCart = () => {
    if (pieces.length === 0) {
      alert('请先添加板件');
      return;
    }

    onAddToCart({
      id: `${product.id}_${Date.now()}`,
      product,
      quantity: 1,
      totalPrice,
      config: {
        productType,
        boardWidthMm: boardWidth,
        boardHeightMm: boardHeight,
        minGapMm: minGap,
        groupFactor: settings.group_factor,
        pieces,
      },
    });

    setPieces([]);
    alert('已加入购物车');
  };

  const scale = 680 / boardWidth;
  const svgWidth = 680;
  const svgHeight = Math.max(240, boardHeight * scale);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <label className="text-sm font-bold">宽(mm)
          <input className="w-full border rounded px-2 py-1 mt-1" type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        </label>
        <label className="text-sm font-bold">高(mm)
          <input className="w-full border rounded px-2 py-1 mt-1" type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
        </label>
        <label className="text-sm font-bold">厚度(mm)
          <select className="w-full border rounded px-2 py-1 mt-1" value={thickness} onChange={(e) => setThickness(Number(e.target.value))}>
            {settings.thickness_options.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <div className="text-sm font-bold">拼单系数
          <div className="mt-2">{settings.group_factor}</div>
        </div>
        <div className="flex items-end">
          <button onClick={addPiece} className="w-full bg-blue-600 text-white rounded px-3 py-2 font-bold">添加板件</button>
        </div>
      </div>

      <div className="text-xs text-slate-500">
        大板: {boardWidth} x {boardHeight}mm，最小间隔: {minGap}mm
      </div>

      <div className="overflow-auto border rounded-xl p-2 bg-slate-50">
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${boardWidth} ${boardHeight}`} className="bg-white border border-slate-300">
          <rect x={0} y={0} width={boardWidth} height={boardHeight} fill="#f8fafc" stroke="#64748b" strokeWidth={4} />
          {reserved.map((r: any, idx: number) => (
            <rect key={`r_${idx}`} x={r.x} y={r.y} width={r.width} height={r.height} fill="#9ca3af" opacity={0.75} />
          ))}
          {pieces.map((p) => (
            <g key={p.id}>
              <rect x={p.x} y={p.y} width={p.width} height={p.height} fill="#3b82f6" opacity={0.85} />
              <text x={(p.x || 0) + p.width / 2} y={(p.y || 0) + p.height / 2} textAnchor="middle" fill="white" fontSize="26">
                {p.width}x{p.height}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="space-y-2">
        {pieces.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-sm border rounded p-2">
            <span>{p.width} x {p.height}mm / {p.thicknessMm}mm / ¥{p.price}</span>
            <button onClick={() => removePiece(p.id)} className="text-red-600">删除</button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <div className="font-black">总价: ¥{totalPrice.toFixed(2)}</div>
        <button onClick={addToCart} className="bg-slate-900 text-white px-5 py-2 rounded font-bold">加入购物车</button>
      </div>
    </div>
  );
};

export default SharedBoardEditor;
