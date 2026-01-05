
import React from 'react';
import { CartItem, User, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { FileDown, X, Printer } from 'lucide-react';
import FactorySheet from './FactorySheet';

interface FactorySheetPreviewProps {
  cart: CartItem[];
  user: User | null;
  language: Language;
  onClose: () => void;
  onDownload: () => void;
}

const FactorySheetPreview: React.FC<FactorySheetPreviewProps> = ({ cart, user, language, onClose, onDownload }) => {
  const t = TRANSLATIONS[language];
  const dateStr = new Date().toLocaleDateString();
  const orderRef = React.useMemo(() => Math.random().toString(36).substr(2, 6).toUpperCase(), []);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm overflow-y-auto flex items-start justify-center p-4">
      <div className="bg-white w-full max-w-4xl min-h-[29.7cm] shadow-2xl my-4 rounded-lg flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-2">
             <h3 className="font-bold text-lg">{t.preview}</h3>
             <span className="text-slate-400 text-sm hidden md:inline"> | {t.verify}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 hover:bg-slate-700 rounded text-sm flex items-center gap-2">
               <X className="w-4 h-4" /> {t.close}
            </button>
            {/*
            <button onClick={() => window.print()} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm flex items-center gap-2">
               <Printer className="w-4 h-4" /> {t.print}
            </button>
            */}
            <button onClick={onDownload} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 shadow-lg">
              <FileDown className="w-4 h-4" /> {t.downloadPdf}
            </button>
          </div>
        </div>

        {/* Paper Content Wrapper for Preview */}
        <div className="overflow-auto bg-slate-100 p-4 flex justify-center">
            {/* 
                We create a dedicated div for the content to ensure it matches the PDF export dimensions logic if needed,
                but here we just render the component.
            */}
            <FactorySheet 
                cart={cart} 
                user={user} 
                language={language} 
                orderRef={orderRef}
                dateStr={dateStr}
            />
        </div>
      </div>
    </div>
  );
};

export default FactorySheetPreview;
