import React, { useRef, useState } from 'react';
import { CartItem, User, Language, Address } from '../types';
import { TRANSLATIONS } from '../constants';
import { FileDown, Image, FileImage, Printer, X } from 'lucide-react';
import FactorySheet from './FactorySheet';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { buildOrderPdfFilename, formatEast8Date } from '../utils/orderFormatting';

/**
 * Standalone preview page – rendered in a new browser window.
 * Reads cart / user / language data from sessionStorage (set by the opener).
 * Provides toolbar to export as PDF, PNG, JPG, or print.
 */
interface PreviewData {
  cart: CartItem[];
  user: User | null;
  language: Language;
  showPrice: boolean;
  address?: Address;
  shippingMethod?: string;
  shippingFee?: number;
  overlengthFee?: number;
}

const readPreviewData = (): PreviewData | null => {
  try {
    const raw = localStorage.getItem('__factorySheetPreviewData');
    if (!raw) return null;
    localStorage.removeItem('__factorySheetPreviewData');
    return JSON.parse(raw) as PreviewData;
  } catch {
    return null;
  }
};

const FactorySheetPreviewPage: React.FC = () => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // Read data only once on mount via useState initializer
  const [data] = useState<PreviewData | null>(readPreviewData);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 text-xl font-bold">
        No preview data found. Please open this page from the cart.
      </div>
    );
  }

  const { cart, user, language, showPrice, address, shippingMethod, shippingFee, overlengthFee } = data;
  const t = TRANSLATIONS[language];
  const dateStr = formatEast8Date(new Date());
  const orderRef = React.useMemo(() => Math.random().toString(36).substr(2, 6).toUpperCase(), []);
  const totalAmount = cart.reduce((sum, item) => sum + (item.totalPrice || 0), 0) + (shippingFee || 0);
  const fileBaseName = buildOrderPdfFilename({
    createdAt: new Date(),
    userName: address?.recipient_name || user?.name || user?.id,
    amount: totalAmount,
    orderRef,
    withPrice: showPrice,
  }).replace(/\.pdf$/i, '');

  // ---- Export helpers ----

  const captureCanvas = async () => {
    if (!sheetRef.current) return null;
    return html2canvas(sheetRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
  };

  const handleExportPNG = async () => {
    setExporting(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `${fileBaseName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  };

  const handleExportJPG = async () => {
    setExporting(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `${fileBaseName}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.92);
      link.click();
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const MARGIN_MM = 8;
      const printableHeight = pdfHeight - MARGIN_MM * 2;
      const contentWidth = pdfWidth;
      const imgScale = contentWidth / canvas.width;

      let srcY = 0;
      let page = 0;
      while (srcY < canvas.height) {
        if (page > 0) pdf.addPage();
        const sliceHeightPx = Math.min(printableHeight / imgScale, canvas.height - srcY);

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;
        const ctx = sliceCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

        const sliceData = sliceCanvas.toDataURL('image/png');
        const imgH = sliceHeightPx * imgScale;
        pdf.addImage(sliceData, 'PNG', 0, MARGIN_MM, contentWidth, imgH);

        srcY += sliceHeightPx;
        page++;
      }

      pdf.save(`${fileBaseName}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    window.close();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Print-specific styles to ensure backgrounds & colors render in print */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body { background: white !important; }
        }
      `}} />
      {/* Toolbar – hidden when printing */}
      <div className="print:hidden sticky top-0 z-50 bg-slate-800 text-white shadow-2xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-lg">{t.preview}</h3>
            <span className="text-slate-400 text-sm hidden md:inline">| {t.verify}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Print */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-bold transition-all"
            >
              <Printer className="w-4 h-4" /> {t.print}
            </button>

            {/* Close */}
            <button
              onClick={handleClose}
              className="flex items-center gap-2 hover:bg-slate-700 px-4 py-2 rounded text-sm transition-all"
            >
              <X className="w-4 h-4" /> {t.close}
            </button>
          </div>
        </div>

        {exporting && (
          <div className="bg-blue-600 text-center text-xs py-1 animate-pulse font-bold tracking-widest">
            {t.exporting || 'Exporting...'}
          </div>
        )}
      </div>

      {/* Sheet content */}
      <div className="flex justify-center py-8 px-4 print:py-0 print:px-0">
        <div ref={sheetRef}>
          <FactorySheet
            cart={cart}
            user={user}
            language={language}
            orderRef={orderRef}
            dateStr={dateStr}
            showPrice={showPrice}
            address={address}
            shippingMethod={shippingMethod}
            shippingFee={shippingFee}
            overlengthFee={overlengthFee}
          />
        </div>
      </div>
    </div>
  );
};

export default FactorySheetPreviewPage;
