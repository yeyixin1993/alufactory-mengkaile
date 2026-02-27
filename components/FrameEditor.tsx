import React, { useMemo, useState } from 'react';
import { Product } from '../types';

interface FrameEditorProps {
  product: Product;
  onAddToCart: (item: any) => void;
}

const sizeMap = {
  A5: { widthCm: 14.8, heightCm: 21 },
  A4: { widthCm: 21, heightCm: 29.7 },
  A3: { widthCm: 29.7, heightCm: 42 },
};

const frameStyleOptions = [
  { value: '极简直角', label: '极简直角', extraPrice: 0 },
  { value: '细边现代', label: '细边现代 (+¥12)', extraPrice: 12 },
  { value: '古典倒角', label: '古典倒角 (+¥24)', extraPrice: 24 },
];

const frameColorOptions = [
  { value: '黑色', label: '黑色', cssColor: '#111827', extraPrice: 0 },
  { value: '银色', label: '银色 (+¥8)', cssColor: '#9ca3af', extraPrice: 8 },
  { value: '香槟金', label: '香槟金 (+¥16)', cssColor: '#c9a84f', extraPrice: 16 },
  { value: '白色', label: '白色 (+¥6)', cssColor: '#e5e7eb', extraPrice: 6 },
];

const frameMaterialOptions = [
  { value: '铝合金', label: '铝合金 (+¥0)', extraPrice: 0 },
  { value: '实木纹铝', label: '实木纹铝 (+¥18)', extraPrice: 18 },
];

const defaultImageUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#dbeafe"/>
      <stop offset="100%" stop-color="#bfdbfe"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#g1)"/>
  <rect x="70" y="70" width="660" height="860" fill="none" stroke="#1e3a8a" stroke-width="18"/>
  <text x="400" y="490" font-size="54" text-anchor="middle" fill="#1e3a8a" font-family="Arial">默认画芯</text>
  <text x="400" y="560" font-size="28" text-anchor="middle" fill="#1e40af" font-family="Arial">Default Artwork</text>
</svg>
`);

const samples = [
  {
    id: 'klee',
    label: 'Paul Klee Sample',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Paul_Klee%2C_Hammamet_with_its_Mosque%2C_1914.jpg',
  },
  {
    id: 'matisse',
    label: 'Henri Matisse Sample',
    url: 'https://upload.wikimedia.org/wikipedia/en/b/b7/Henri_Matisse%2C_1910%2C_Dance_%28first_version%29.jpg',
  },
];

const FrameEditor: React.FC<FrameEditorProps> = ({ product, onAddToCart }) => {
  const [size, setSize] = useState<keyof typeof sizeMap>('A4');
  const [frameStyle, setFrameStyle] = useState('极简直角');
  const [frameMaterial, setFrameMaterial] = useState('铝合金');
  const [frameColor, setFrameColor] = useState('黑色');
  const [hasMat, setHasMat] = useState(true);
  const [matBorderWidthCm, setMatBorderWidthCm] = useState(2);
  const [imageSource, setImageSource] = useState<'sample' | 'upload'>('sample');
  const [imageUrl, setImageUrl] = useState(defaultImageUrl);

  const sizeInfo = sizeMap[size];
  const selectedStyle = frameStyleOptions.find((opt) => opt.value === frameStyle) || frameStyleOptions[0];
  const selectedMaterial = frameMaterialOptions.find((opt) => opt.value === frameMaterial) || frameMaterialOptions[0];
  const selectedColor = frameColorOptions.find((opt) => opt.value === frameColor) || frameColorOptions[0];

  const price = useMemo(() => {
    const basePrice = sizeInfo.widthCm + sizeInfo.heightCm;
    const total = basePrice + selectedStyle.extraPrice + selectedMaterial.extraPrice + selectedColor.extraPrice;
    return Number(total.toFixed(2));
  }, [sizeInfo, selectedStyle.extraPrice, selectedMaterial.extraPrice, selectedColor.extraPrice]);

  const previewImage = imageUrl || defaultImageUrl;

  // 卡纸默认与画框同外径，通常不改单独外宽/外高
  const matOuterWidthSafe = sizeInfo.widthCm;
  const matOuterHeightSafe = sizeInfo.heightCm;
  const maxMatBorder = Math.max(0.2, Math.min(matOuterWidthSafe, matOuterHeightSafe) / 2 - 0.2);
  const matBorderSafe = Math.max(0.2, Math.min(matBorderWidthCm, maxMatBorder));
  const matInnerWidthSafe = Math.max(1, matOuterWidthSafe - matBorderSafe * 2);
  const matInnerHeightSafe = Math.max(1, matOuterHeightSafe - matBorderSafe * 2);

  const previewScale = Math.min(280 / sizeInfo.widthCm, 320 / sizeInfo.heightCm);
  const frameOuterWidthPx = sizeInfo.widthCm * previewScale;
  const frameOuterHeightPx = sizeInfo.heightCm * previewScale;
  const frameBorderPx = Math.max(8, Math.min(24, Math.round(Math.min(frameOuterWidthPx, frameOuterHeightPx) * 0.11)));

  const matOuterWidthPx = hasMat ? Math.max(20, (matOuterWidthSafe / sizeInfo.widthCm) * (frameOuterWidthPx - frameBorderPx * 2)) : 0;
  const matOuterHeightPx = hasMat ? Math.max(20, (matOuterHeightSafe / sizeInfo.heightCm) * (frameOuterHeightPx - frameBorderPx * 2)) : 0;
  const matInnerWidthPx = hasMat ? Math.max(12, (matInnerWidthSafe / matOuterWidthSafe) * matOuterWidthPx) : 0;
  const matInnerHeightPx = hasMat ? Math.max(12, (matInnerHeightSafe / matOuterHeightSafe) * matOuterHeightPx) : 0;

  const onUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSource('upload');
      setImageUrl(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const addToCart = () => {
    onAddToCart({
      id: `${product.id}_${Date.now()}`,
      product,
      quantity: 1,
      totalPrice: price,
      config: {
        size,
        widthCm: sizeInfo.widthCm,
        heightCm: sizeInfo.heightCm,
        frameStyle,
        frameMaterial,
        frameColor,
        frameStylePrice: selectedStyle.extraPrice,
        frameMaterialPrice: selectedMaterial.extraPrice,
        frameColorPrice: selectedColor.extraPrice,
        hasMat,
        matBorderWidthCm: hasMat ? matBorderSafe : undefined,
        matOuterWidthCm: hasMat ? matOuterWidthSafe : undefined,
        matOuterHeightCm: hasMat ? matOuterHeightSafe : undefined,
        matInnerWidthCm: hasMat ? matInnerWidthSafe : undefined,
        matInnerHeightCm: hasMat ? matInnerHeightSafe : undefined,
        imageSource,
        imageUrl: previewImage,
      },
    });
    alert('相框配置已加入购物车');
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="block text-sm font-bold">尺寸
            <select className="w-full border rounded px-2 py-1 mt-1" value={size} onChange={(e) => setSize(e.target.value as keyof typeof sizeMap)}>
              <option value="A5">A5</option>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
          </label>

          <label className="block text-sm font-bold">相框样式
            <select className="w-full border rounded px-2 py-1 mt-1" value={frameStyle} onChange={(e) => setFrameStyle(e.target.value)}>
              {frameStyleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-bold">相框材质
            <select className="w-full border rounded px-2 py-1 mt-1" value={frameMaterial} onChange={(e) => setFrameMaterial(e.target.value)}>
              {frameMaterialOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-bold">相框颜色
            <select className="w-full border rounded px-2 py-1 mt-1" value={frameColor} onChange={(e) => setFrameColor(e.target.value)}>
              {frameColorOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={hasMat} onChange={(e) => setHasMat(e.target.checked)} /> 是否卡纸
          </label>

          {hasMat && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-700 font-semibold">
                卡纸外径宽(cm)
                <input className="border rounded px-2 py-1 mt-1 w-full bg-slate-100" type="number" value={matOuterWidthSafe.toFixed(1)} readOnly />
              </label>
              <label className="text-xs text-slate-700 font-semibold">
                卡纸外径高(cm)
                <input className="border rounded px-2 py-1 mt-1 w-full bg-slate-100" type="number" value={matOuterHeightSafe.toFixed(1)} readOnly />
              </label>
              <label className="text-xs text-slate-700 font-semibold col-span-2">
                卡纸边宽(cm，四边一致)
                <input
                  className="border rounded px-2 py-1 mt-1 w-full"
                  type="number"
                  min={0.2}
                  step={0.1}
                  value={matBorderWidthCm}
                  onChange={(e) => setMatBorderWidthCm(Number(e.target.value || 0.2))}
                />
              </label>
              <div className="text-xs text-slate-600 col-span-2">
                自动内径：{matInnerWidthSafe.toFixed(1)} × {matInnerHeightSafe.toFixed(1)} cm（由外径和统一边宽自动计算）
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-bold">图片来源</div>
            <div className="flex gap-2 flex-wrap">
              {samples.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setImageSource('sample');
                    setImageUrl(s.url);
                  }}
                  className="px-3 py-1 border rounded"
                >
                  {s.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setImageSource('sample');
                  setImageUrl(defaultImageUrl);
                }}
                className="px-3 py-1 border rounded"
              >
                默认画芯
              </button>
            </div>
            <input type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0])} />
          </div>
        </div>

        <div>
          <div className="text-sm font-bold mb-2">预览</div>
          <div className="bg-slate-200 rounded-xl p-6 flex items-center justify-center min-h-[360px]">
            <div
              style={{
                width: `${frameOuterWidthPx}px`,
                height: `${frameOuterHeightPx}px`,
                border: `${frameBorderPx}px solid ${selectedColor.cssColor}`,
                background: '#f8fafc',
                boxShadow: '0 8px 20px rgba(15, 23, 42, 0.20)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {hasMat ? (
                <div
                  style={{
                    width: `${matOuterWidthPx}px`,
                    height: `${matOuterHeightPx}px`,
                    background: '#f7f3e8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={previewImage}
                    alt="frame preview"
                    style={{ width: `${matInnerWidthPx}px`, height: `${matInnerHeightPx}px`, objectFit: 'cover' }}
                  />
                </div>
              ) : (
                <img
                  src={previewImage}
                  alt="frame preview"
                  style={{
                    width: `${Math.max(24, frameOuterWidthPx - frameBorderPx * 2)}px`,
                    height: `${Math.max(24, frameOuterHeightPx - frameBorderPx * 2)}px`,
                    objectFit: 'cover',
                  }}
                />
              )}
            </div>
          </div>
          <div className="mt-3 text-sm text-slate-600">价格规则：长+宽（cm） + 样式/材质/颜色附加价</div>
          <div className="mt-1 font-black text-xl">¥{price.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={addToCart} className="bg-slate-900 text-white rounded px-5 py-2 font-bold">加入购物车</button>
      </div>
    </div>
  );
};

export default FrameEditor;
