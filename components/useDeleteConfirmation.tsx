import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import type { Language } from '../types';

export function useDeleteConfirmation(language: Language) {
  const [message, setMessage] = useState<string | null>(null);
  const resolve = useRef<((value: boolean) => void) | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const finish = (value: boolean) => { resolve.current?.(value); resolve.current = null; setMessage(null); };
  useEffect(() => {
    if (message === null) return;
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancel.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); finish(false); }
      if (event.key === 'Tab') {
        const buttons = cancel.current?.parentElement?.querySelectorAll('button');
        if (!buttons?.length) return;
        event.preventDefault();
        (document.activeElement === buttons[0] ? buttons[1] : buttons[0]).focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus(); };
  }, [message]);
  useEffect(() => () => { resolve.current?.(false); }, []);
  const confirm = (text: string) => new Promise<boolean>(done => { resolve.current?.(false); resolve.current = done; setMessage(text); });
  const dialog = message === null ? null : createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => finish(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-message" className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><Trash2 /></div>
        <h2 id="delete-confirm-title" className="text-xl font-black text-slate-900">{language === 'cn' ? '确认删除' : language === 'jp' ? '削除の確認' : 'Confirm removal'}</h2>
        <p id="delete-confirm-message" className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button ref={cancel} type="button" onClick={() => finish(false)} className="rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 hover:bg-slate-200">{language === 'cn' ? '取消' : language === 'jp' ? 'キャンセル' : 'Cancel'}</button>
          <button type="button" onClick={() => finish(true)} className="rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700">{language === 'cn' ? '确认删除' : language === 'jp' ? '削除する' : 'Remove'}</button>
        </div>
      </div>
    </div>, document.body);
  return { confirm, dialog };
}
