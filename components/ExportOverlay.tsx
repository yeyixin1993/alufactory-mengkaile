import React, { useEffect } from 'react';

interface ExportOverlayProps {
  visible: boolean;
  message?: string;
  warning?: string;
}

/**
 * Full-page overlay shown during PDF / image export.
 * Greys out the entire page, shows a spinner + warning text,
 * and blocks the browser's beforeunload so the user doesn't
 * accidentally navigate away while html2canvas is working.
 */
const ExportOverlay: React.FC<ExportOverlayProps> = ({ visible, message, warning }) => {
  useEffect(() => {
    if (!visible) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center gap-6 max-w-sm mx-4 border border-slate-200">
        {/* Spinner */}
        <div className="w-16 h-16 border-[5px] border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        {/* Message */}
        <div className="text-center space-y-3">
          <p className="text-xl font-black text-slate-800">{message || 'Exporting...'}</p>
          {warning && (
            <p className="text-sm text-red-500 font-bold animate-pulse">{warning}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportOverlay;
