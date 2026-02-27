import React, { useMemo, useState } from 'react';
import { Product } from '../types';

interface Props {
  product: Product;
  onAddToCart: (item: any) => void;
}

const variants = [
  {
    id: 'small_narrow',
    name: '小窄款 (2个=1层)',
    widthCm: 42,
    depthCm: 39,
    heightCm: 41,
    unitCount: 1,
    imageUrl: 'https://images.ikea.com/is/image/IKEA/70301542',
  },
  {
    id: 'small_wide',
    name: '小宽款 (1个=1层)',
    widthCm: 77,
    depthCm: 39,
    heightCm: 42,
    unitCount: 1,
    imageUrl: 'https://images.ikea.com/is/image/IKEA/80275887',
  },
  {
    id: 'medium_wide',
    name: '中宽款 (1个=2层)',
    widthCm: 77,
    depthCm: 39,
    heightCm: 77,
    unitCount: 2,
    imageUrl: 'https://images.ikea.com/is/image/IKEA/70351886',
  },
  {
    id: 'large_wide',
    name: '大宽款 (1个=3层)',
    widthCm: 77,
    depthCm: 39,
    heightCm: 147,
    unitCount: 3,
    imageUrl: 'https://images.ikea.com/is/image/IKEA/60351877',
  },
];

const wheelPriceMap = {
  none: 0,
  basic: 50,
  nobel: 200,
};

const unitPrice = 30;

const calcUnitsForVariant = (variantId: string, count: number, unitCount: number) => {
  const safeCount = Math.max(0, count || 0);
  if (variantId === 'small_narrow') {
    // 小窄款：2个占1个unit高，奇数向上取整
    return Math.ceil(safeCount / 2);
  }
  if (variantId === 'small_wide') {
    // 小宽款：1个占1个unit高
    return safeCount;
  }
  return safeCount * unitCount;
};

type PlacementItem = {
  key: string;
  variantId: string;
  label: string;
  heightUnits: 1 | 2 | 3;
};

type ColumnPlacement = PlacementItem & {
  col: number;
  startRow: number;
};

type LayoutObjective = {
  maxHeight: number;
  range: number;
};

const buildPlacementItems = (countsByVariant: Record<string, number>): PlacementItem[] => {
  const items: PlacementItem[] = [];

  const narrowUnits = Math.ceil(Math.max(0, countsByVariant.small_narrow || 0) / 2);
  for (let i = 0; i < narrowUnits; i += 1) {
    items.push({ key: `small_narrow_${i}`, variantId: 'small_narrow', label: '小窄', heightUnits: 1 });
  }

  const smallWideCount = Math.max(0, countsByVariant.small_wide || 0);
  for (let i = 0; i < smallWideCount; i += 1) {
    items.push({ key: `small_wide_${i}`, variantId: 'small_wide', label: '小宽', heightUnits: 1 });
  }

  const mediumWideCount = Math.max(0, countsByVariant.medium_wide || 0);
  for (let i = 0; i < mediumWideCount; i += 1) {
    items.push({ key: `medium_wide_${i}`, variantId: 'medium_wide', label: '中宽', heightUnits: 2 });
  }

  const largeWideCount = Math.max(0, countsByVariant.large_wide || 0);
  for (let i = 0; i < largeWideCount; i += 1) {
    items.push({ key: `large_wide_${i}`, variantId: 'large_wide', label: '大宽', heightUnits: 3 });
  }

  return items;
};

const getObjective = (heights: number[]): LayoutObjective => {
  const maxHeight = Math.max(0, ...heights);
  const minHeight = Math.min(...heights);
  return { maxHeight, range: maxHeight - minHeight };
};

const isBetterObjective = (next: LayoutObjective, current: LayoutObjective) => {
  if (next.maxHeight !== current.maxHeight) return next.maxHeight < current.maxHeight;
  return next.range < current.range;
};

const buildColumnLayout = (items: PlacementItem[], columns: 1 | 2 | 3) => {
  if (columns <= 1) {
    const placements: ColumnPlacement[] = [];
    let h = 0;
    const sortedSingle = [...items].sort((a, b) => b.heightUnits - a.heightUnits);
    sortedSingle.forEach((item) => {
      placements.push({ ...item, col: 0, startRow: h });
      h += item.heightUnits;
    });
    return { placements, rows: h };
  }

  const sorted = [...items].sort((a, b) => b.heightUnits - a.heightUnits);
  const columnsItems: PlacementItem[][] = Array.from({ length: columns }, () => []);
  const heights = Array.from({ length: columns }, () => 0);

  // Initial greedy placement
  sorted.forEach((item) => {
    let minIndex = 0;
    for (let i = 1; i < heights.length; i += 1) {
      if (heights[i] < heights[minIndex]) minIndex = i;
    }
    columnsItems[minIndex].push(item);
    heights[minIndex] += item.heightUnits;
  });

  // Local optimization: moves + swaps, minimizing max column height first
  for (let iter = 0; iter < 80; iter += 1) {
    const currentObjective = getObjective(heights);
    let bestObjective = currentObjective;
    let bestMove:
      | { type: 'move'; from: number; to: number; itemIndex: number }
      | { type: 'swap'; a: number; b: number; ai: number; bi: number }
      | null = null;

    // Try single-item moves
    for (let from = 0; from < columns; from += 1) {
      for (let itemIndex = 0; itemIndex < columnsItems[from].length; itemIndex += 1) {
        const item = columnsItems[from][itemIndex];
        for (let to = 0; to < columns; to += 1) {
          if (to === from) continue;
          const nextHeights = [...heights];
          nextHeights[from] -= item.heightUnits;
          nextHeights[to] += item.heightUnits;
          const nextObjective = getObjective(nextHeights);
          if (isBetterObjective(nextObjective, bestObjective)) {
            bestObjective = nextObjective;
            bestMove = { type: 'move', from, to, itemIndex };
          }
        }
      }
    }

    // Try pair swaps
    for (let a = 0; a < columns; a += 1) {
      for (let b = a + 1; b < columns; b += 1) {
        for (let ai = 0; ai < columnsItems[a].length; ai += 1) {
          for (let bi = 0; bi < columnsItems[b].length; bi += 1) {
            const itemA = columnsItems[a][ai];
            const itemB = columnsItems[b][bi];
            if (itemA.heightUnits === itemB.heightUnits) continue;

            const nextHeights = [...heights];
            nextHeights[a] = nextHeights[a] - itemA.heightUnits + itemB.heightUnits;
            nextHeights[b] = nextHeights[b] - itemB.heightUnits + itemA.heightUnits;
            const nextObjective = getObjective(nextHeights);
            if (isBetterObjective(nextObjective, bestObjective)) {
              bestObjective = nextObjective;
              bestMove = { type: 'swap', a, b, ai, bi };
            }
          }
        }
      }
    }

    if (!bestMove) break;

    if (bestMove.type === 'move') {
      const [moved] = columnsItems[bestMove.from].splice(bestMove.itemIndex, 1);
      columnsItems[bestMove.to].push(moved);
      heights[bestMove.from] -= moved.heightUnits;
      heights[bestMove.to] += moved.heightUnits;
    } else {
      const itemA = columnsItems[bestMove.a][bestMove.ai];
      const itemB = columnsItems[bestMove.b][bestMove.bi];
      columnsItems[bestMove.a][bestMove.ai] = itemB;
      columnsItems[bestMove.b][bestMove.bi] = itemA;
      heights[bestMove.a] = heights[bestMove.a] - itemA.heightUnits + itemB.heightUnits;
      heights[bestMove.b] = heights[bestMove.b] - itemB.heightUnits + itemA.heightUnits;
    }
  }

  const placements: ColumnPlacement[] = [];
  for (let col = 0; col < columns; col += 1) {
    const stack = [...columnsItems[col]].sort((a, b) => b.heightUnits - a.heightUnits);
    let currentRow = 0;
    stack.forEach((item) => {
      placements.push({ ...item, col, startRow: currentRow });
      currentRow += item.heightUnits;
    });
  }

  return {
    placements,
    rows: Math.max(0, ...heights),
  };
};

const ShufateCabinetEditor: React.FC<Props> = ({ product, onAddToCart }) => {
  const [countsByVariant, setCountsByVariant] = useState<Record<string, number>>(
    variants.reduce((acc, v, idx) => ({ ...acc, [v.id]: idx === 0 ? 1 : 0 }), {})
  );
  const [columns, setColumns] = useState<1 | 2 | 3>(2);
  const [wheelType, setWheelType] = useState<'none' | 'basic' | 'nobel'>('none');

  const chosenVariants = useMemo(
    () => variants.filter((v) => (countsByVariant[v.id] || 0) > 0),
    [countsByVariant]
  );

  const totalCabinets = useMemo(
    () => variants.reduce((sum, v) => sum + (countsByVariant[v.id] || 0), 0),
    [countsByVariant]
  );

  const totalUnits = useMemo(
    () => variants.reduce((sum, v) => sum + calcUnitsForVariant(v.id, countsByVariant[v.id] || 0, v.unitCount), 0),
    [countsByVariant]
  );

  const placementItems = useMemo(() => buildPlacementItems(countsByVariant), [countsByVariant]);
  const selectedLayout = useMemo(() => buildColumnLayout(placementItems, columns), [placementItems, columns]);
  const rows = selectedLayout.rows;
  const totalPrice = totalUnits * unitPrice + wheelPriceMap[wheelType] * Math.max(1, totalCabinets);

  const gridBlocks = useMemo(() => Array.from({ length: Math.max(0, rows * columns) }), [rows, columns]);

  const columnCandidates: Array<1 | 2 | 3> = [1, 2, 3];
  const sortedColumnCandidates = useMemo(() => {
    return [...columnCandidates].sort((a, b) => {
      const aRows = buildColumnLayout(placementItems, a).rows;
      const bRows = buildColumnLayout(placementItems, b).rows;
      if (aRows !== bRows) return aRows - bRows;
      return a - b;
    });
  }, [placementItems]);

  const addToCart = () => {
    if (totalCabinets <= 0 || totalUnits <= 0) {
      alert('请先填写至少一种书法特的数量');
      return;
    }

    onAddToCart({
      id: `${product.id}_${Date.now()}`,
      product,
      quantity: 1,
      totalPrice,
      config: {
        mix: chosenVariants.map((v) => ({
          variantId: v.id,
          variantName: v.name,
          widthCm: v.widthCm,
          depthCm: v.depthCm,
          heightCm: v.heightCm,
          count: countsByVariant[v.id] || 0,
          unitPerCabinet: v.unitCount,
          effectiveUnits: calcUnitsForVariant(v.id, countsByVariant[v.id] || 0, v.unitCount),
        })),
        totalCabinets,
        unitCount: totalUnits,
        columns,
        rows,
        wheelType,
      },
    });

    alert('书法特柜子配置已加入购物车');
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="text-sm font-bold">先选每种书法特数量（支持混搭）</div>
          <div className="space-y-2">
            {variants.map((v) => (
              <div key={v.id} className="rounded-lg border p-2">
                <div className="text-sm font-semibold">{v.name}</div>
                <div className="text-xs text-slate-500 mb-1">
                  {v.widthCm} x {v.depthCm} x {v.heightCm} cm /
                  {v.id === 'small_narrow'
                    ? ' 2个=1层（奇数向上取整）'
                    : v.id === 'small_wide'
                    ? ' 1个=1层'
                    : ` 每个${v.unitCount}层`}
                </div>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="number"
                  min={0}
                  value={countsByVariant[v.id] || 0}
                  onChange={(e) => {
                    const next = Math.max(0, Number(e.target.value || 0));
                    setCountsByVariant((prev) => ({ ...prev, [v.id]: next }));
                  }}
                />
              </div>
            ))}
          </div>

          <label className="block text-sm font-bold">轮子
            <select className="w-full border rounded px-2 py-1 mt-1" value={wheelType} onChange={(e) => setWheelType(e.target.value as any)}>
              <option value="none">不要轮子 (+0)</option>
              <option value="basic">一般轮子 (+50/个柜子)</option>
              <option value="nobel">诺贝轮子 (+200/个柜子)</option>
            </select>
          </label>

          <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
            <div>总柜子数: {totalCabinets}</div>
            <div>总 unit: {totalUnits}</div>
            <div>自动计算层数: {rows}（当前选中 {columns} 列）</div>
            <div className="font-black text-lg">总价: ¥{totalPrice.toFixed(2)}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-bold">选择列数布局（先看三种效果图）</div>
          <div className="grid grid-cols-1 gap-3">
            {sortedColumnCandidates.map((col) => {
              const candidateLayout = buildColumnLayout(placementItems, col);
              const candidateRows = Math.max(1, candidateLayout.rows || 1);
              const active = columns === col;
              return (
                <button
                  key={col}
                  onClick={() => setColumns(col)}
                  className={`rounded-xl border p-3 text-left ${active ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="text-sm font-bold mb-2">{col} 列 × {candidateRows} 行</div>
                  <div
                    className="grid gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${col}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${candidateRows}, minmax(0, 28px))`,
                    }}
                  >
                    {Array.from({ length: Math.max(1, candidateRows * col) }).map((_, idx) => (
                      <div key={`slot_${idx}`} className="rounded border border-dashed border-slate-300 bg-slate-50" />
                    ))}
                    {candidateLayout.placements.map((p) => (
                      <div
                        key={`${p.key}_${col}`}
                        className="rounded bg-blue-100 border border-blue-300 flex items-center justify-center text-[10px] font-bold text-blue-700"
                        style={{
                          gridColumnStart: p.col + 1,
                          gridRow: `${p.startRow + 1} / span ${p.heightUnits}`,
                        }}
                      >
                        {p.label} {p.heightUnits}层
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {chosenVariants.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {chosenVariants.map((v) => (
                <div key={v.id} className="rounded-lg border p-2">
                  <img src={v.imageUrl} alt={v.name} className="w-full h-20 object-cover rounded border" />
                  <div className="mt-1 text-xs font-semibold">{v.name} × {countsByVariant[v.id] || 0}</div>
                </div>
              ))}
            </div>
          )}

          {totalUnits > 0 && (
            <div>
              <div className="text-sm font-bold mb-2">已选布局预览</div>
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${Math.max(1, rows)}, minmax(0, 40px))`,
                }}
              >
                {gridBlocks.map((_, idx) => (
                  <div key={`selected_slot_${idx}`} className="rounded border border-dashed border-slate-300 bg-slate-50" />
                ))}
                {selectedLayout.placements.map((p) => (
                  <div
                    key={`selected_${p.key}`}
                    className="rounded bg-blue-100 border border-blue-300 flex items-center justify-center text-xs font-bold text-blue-700"
                    style={{
                      gridColumnStart: p.col + 1,
                      gridRow: `${p.startRow + 1} / span ${p.heightUnits}`,
                    }}
                  >
                    {p.label} {p.heightUnits}层
                  </div>
                ))}
              </div>
            </div>
          )}
          {totalUnits === 0 && (
            <div className="text-sm text-slate-500 rounded-lg border border-dashed p-4">先填写上方数量，系统会自动计算层数并展示布局。</div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={addToCart} className="bg-slate-900 text-white rounded px-5 py-2 font-bold">加入购物车</button>
      </div>
    </div>
  );
};

export default ShufateCabinetEditor;
