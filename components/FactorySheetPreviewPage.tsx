import { decodeDesignerSnapshot } from '../utils/designerCartSnapshot';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CartItem, User, Language, Address } from '../types';
import { TRANSLATIONS } from '../constants';
import { FileDown, Image as ImageIcon, Printer, X } from 'lucide-react';
import FactorySheet from './FactorySheet';
import ExportOverlay from './ExportOverlay';
import { buildOrderPdfFilename, formatEast8Date } from '../utils/orderFormatting';
import { calculateScrewPlan } from '../utils/screwCalculator';
import { exportElementToPdf } from '../utils/pdfExport';
import { hasDiyScrewCartItems } from '../utils/cartAccessories';
import { expandFinishedFurnitureCartItems } from '../utils/finishedFurnitureCart';

/**
 * Standalone preview page – rendered in a new browser window.
 * Reads cart / user / language data from sessionStorage (set by the opener).
 *
 * PDF strategy: the primary "download" is the browser's own print-to-PDF,
 * because html2canvas + jsPDF can only produce a raster image of the sheet
 * (blurry when zoomed, text not selectable, and occasionally mis-laid-out
 * when an element is captured before its styles settle). The raster path is
 * kept as a secondary option for mobile / WeChat browsers, which do not
 * implement "Save as PDF".
 */
interface PreviewData {
  cart: CartItem[];
  user: User | null;
  language: Language;
  showPrice: boolean;
  address?: Address;
  shippingMethod?: string;
  shippingFee?: number;
  include304Screws?: boolean;
  includeLabelService?: boolean;
  labelFee?: number;
  overlengthFee?: number;
}

const readPreviewData = (): PreviewData | null => {
  try {
    const raw = localStorage.getItem('__factorySheetPreviewData');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed.format === 'compressed-preview-v1' ? decodeDesignerSnapshot(parsed.data) : parsed) as PreviewData;
  } catch {
    return null;
  }
};

const PRINT_GUIDE_TEXT = {
  cn: {
    title: '打印 / 另存为 PDF',
    intro: '浏览器打印输出的是矢量 PDF：文字可选、可搜索、放大不虚，也不会出现截图排版错乱。',
    steps: [
      '「目标打印机」选择「另存为 PDF」（想直接出纸就选你的打印机）',
      '纸张选 A4，边距保持「默认」',
      '点「保存」，文件名已填好，直接确定即可',
    ],
    go: '打开打印对话框',
    cancel: '取消',
    note: '手机 / 微信浏览器可能没有「另存为 PDF」，请改用右侧的「图片版 PDF」。',
  },
  en: {
    title: 'Print / Save as PDF',
    intro: 'Browser printing produces a vector PDF: selectable, searchable text that stays sharp at any zoom.',
    steps: [
      'Set "Destination" to "Save as PDF" (or pick a printer to print on paper)',
      'Paper: A4 · keep the default margins',
      'Click "Save" — the filename is already filled in',
    ],
    go: 'Open print dialog',
    cancel: 'Cancel',
    note: 'Mobile / WeChat browsers may not offer "Save as PDF" — use "Image PDF" instead.',
  },
  jp: {
    title: '印刷 / PDF として保存',
    intro: 'ブラウザ印刷はベクター PDF を出力します。文字は選択・検索でき、拡大しても劣化しません。',
    steps: [
      '「送信先」で「PDF に保存」を選択（紙に印刷する場合はプリンターを選択）',
      '用紙 A4・余白は「既定」のまま',
      '「保存」をクリック（ファイル名は入力済み）',
    ],
    go: '印刷ダイアログを開く',
    cancel: 'キャンセル',
    note: 'スマートフォン / WeChat のブラウザでは「PDF に保存」が使えない場合があります。「画像 PDF」をご利用ください。',
  },
};

/**
 * Print-only styles. Injected by this page instead of living in index.css so
 * they cannot leak into other printable screens (the product catalogue has its
 * own print contract, including full-bleed 210×297 mm pages).
 *
 * Why the rules look like this:
 *  - @page margin 8mm vertically only: continuation pages must not have their
 *    card borders eaten by the printer's unprintable area, while the left and
 *    right white space stays inside FactorySheet's own p-10 padding. Keeping
 *    the full 210 mm content width also stops cards from growing taller.
 *  - The sheet becomes block-level: Chrome's fragmentation of flex containers
 *    is unreliable, and break-inside:avoid on flex items gets ignored, which
 *    slices cards in half.
 *  - The card body loses 8px of vertical padding and 16px of stack gap. A card
 *    that lands a few dozen pixels over one page would otherwise spill a single
 *    table row onto its own page.
 */
const FACTORY_PRINT_CSS = `
@media print {
  @page {
    size: A4;
    margin: 8mm 0;
  }

  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  /* Keep the dark card headers, coloured alert bars and table fills. */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  .factory-print-toolbar,
  .factory-print-guide,
  .print\\:hidden {
    display: none !important;
  }

  .factory-print-shell {
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  .factory-sheet {
    display: block !important;
    width: 210mm !important;
    max-width: 210mm !important;
    margin: 0 auto !important;
    border: 0 !important;
    box-shadow: none !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
  }

  /* The on-screen layout spaces blocks with flex gap-6; block layout needs an
     equivalent margin so the printed rhythm matches the preview. */
  .factory-sheet > * + * {
    margin-top: 1.5rem;
  }

  /* Never slice a card, a table row, a photo or a hole diagram in half. */
  .factory-sheet [data-pdf-block],
  .factory-sheet tr,
  .factory-sheet img,
  .factory-sheet svg {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Long tables may break, but repeat their header row on the next page. */
  .factory-sheet table {
    break-inside: auto;
    page-break-inside: auto;
  }

  .factory-sheet thead {
    display: table-header-group;
  }

  .factory-sheet .factory-card-body {
    padding-top: 1rem !important;
    padding-bottom: 1rem !important;
  }

  .factory-sheet .factory-card-stack > * + * {
    margin-top: 1rem !important;
  }
}
`;

const FactorySheetPreviewPage: React.FC = () => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [showPrintGuide, setShowPrintGuide] = useState(false);
  const restoreTitleRef = useRef<(() => void) | null>(null);

  // Read data only once on mount via useState initializer
  const [data] = useState<PreviewData | null>(readPreviewData);

  useEffect(() => () => restoreTitleRef.current?.(), []);

  const { cart, user, language, showPrice, address, shippingMethod, shippingFee, include304Screws, includeLabelService, labelFee, overlengthFee } = data || ({} as PreviewData);
  const t = TRANSLATIONS[language || 'cn'];
  const orderRef = React.useMemo(() => Math.random().toString(36).substr(2, 6).toUpperCase(), []);
  const productionCart = React.useMemo(() => expandFinishedFurnitureCartItems(cart || []), [cart]);
  const hasDiyScrews = React.useMemo(() => hasDiyScrewCartItems(productionCart), [productionCart]);
  const screwFee = React.useMemo(
    () => calculateScrewPlan(productionCart, !!include304Screws && !hasDiyScrews).totalFee,
    [productionCart, include304Screws, hasDiyScrews],
  );
  const totalAmount = (cart || []).reduce((sum, item) => sum + (item.totalPrice || 0), 0) + (shippingFee || 0) + screwFee + (labelFee || 0);
  const fileBaseName = React.useMemo(() => buildOrderPdfFilename({
    createdAt: new Date(),
    userName: address?.recipient_name || user?.name || user?.id,
    amount: totalAmount,
    orderRef,
    withPrice: showPrice,
  }).replace(/\.pdf$/i, ''), [address?.recipient_name, user?.name, user?.id, totalAmount, orderRef, showPrice]);
  const dateStr = formatEast8Date(new Date());

  // ---- Export helpers ----

  /**
   * Opens the browser print dialog. The tab title is temporarily replaced with
   * the document number because Chrome / Edge prefill the "Save as PDF"
   * filename with document.title, and it cannot be set from the dialog.
   */
  const startBrowserPrint = useCallback(() => {
    setShowPrintGuide(false);
    if (typeof document === 'undefined') return;
    const previousTitle = document.title;
    document.title = fileBaseName;
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      document.title = previousTitle;
      window.removeEventListener('afterprint', restore);
      if (restoreTitleRef.current === restore) restoreTitleRef.current = null;
    };
    restoreTitleRef.current = restore;
    window.addEventListener('afterprint', restore);
    // Chrome fires afterprint when the dialog closes; keep a timer as a
    // fallback for browsers that never fire it.
    window.setTimeout(restore, 120_000);
    window.print();
  }, [fileBaseName]);

  const handleExportImagePdf = async () => {
    setExporting(true);
    try {
      await exportElementToPdf(sheetRef.current, `${fileBaseName}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const handleClose = () => {
    window.close();
  };

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 text-xl font-bold">
        No preview data found. Please open this page from the cart.
      </div>
    );
  }

  const guide = PRINT_GUIDE_TEXT[language] || PRINT_GUIDE_TEXT.cn;

  return (
    <div className="min-h-screen bg-slate-100">
      <style dangerouslySetInnerHTML={{ __html: FACTORY_PRINT_CSS }} />
      {/* Toolbar – hidden when printing */}
      <div className="factory-print-toolbar print:hidden sticky top-0 z-50 bg-slate-800 text-white shadow-2xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-lg">{t.preview}</h3>
            <span className="text-slate-400 text-sm hidden md:inline">| {t.verify}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowPrintGuide(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-bold transition-all"
            >
              <FileDown className="w-4 h-4" />
              {language === 'cn' ? '下载 PDF' : language === 'jp' ? 'PDFをダウンロード' : 'Download PDF'}
            </button>
            <button
              onClick={startBrowserPrint}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-bold transition-all"
            >
              <Printer className="w-4 h-4" /> {t.print}
            </button>
            <button
              onClick={handleExportImagePdf}
              disabled={exporting}
              title={language === 'cn' ? '图片版（手机 / 微信浏览器可用）' : language === 'jp' ? '画像版（スマートフォン / WeChat 用）' : 'Image version (for mobile / WeChat)'}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-500 px-4 py-2 rounded text-sm font-bold transition-all"
            >
              <ImageIcon className="w-4 h-4" />
              {language === 'cn' ? '图片版 PDF' : language === 'jp' ? '画像 PDF' : 'Image PDF'}
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

      <ExportOverlay visible={exporting} message={t.exportOverlayMessage} warning={t.exportOverlayWarning} />

      {/* Print guide – never printed */}
      {showPrintGuide && (
        <div className="factory-print-guide print:hidden fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-xl font-black text-slate-900">{guide.title}</h3>
              <button onClick={() => setShowPrintGuide(false)} className="text-slate-400 hover:text-slate-700" aria-label="close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{guide.intro}</p>
            <ol className="mt-4 space-y-2 text-sm font-bold text-slate-700">
              {guide.steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">{index + 1}</span>
                  <span className="min-w-0 break-words">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 break-words">
              {language === 'cn' ? '文件名：' : language === 'jp' ? 'ファイル名：' : 'Filename: '}
              <span className="text-slate-800">{fileBaseName}.pdf</span>
            </p>
            <p className="mt-3 text-xs leading-5 text-amber-600 font-bold">{guide.note}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={() => setShowPrintGuide(false)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">
                {guide.cancel}
              </button>
              <button onClick={startBrowserPrint} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-500">
                <Printer className="w-4 h-4" /> {guide.go}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet content */}
      <div className="factory-print-shell flex justify-center py-8 px-4 print:py-0 print:px-0">
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
            include304Screws={include304Screws}
            includeLabelService={includeLabelService}
            labelFee={labelFee}
            overlengthFee={overlengthFee}
          />
        </div>
      </div>
    </div>
  );
};

export default FactorySheetPreviewPage;
