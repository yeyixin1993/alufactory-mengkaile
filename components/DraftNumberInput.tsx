import React, { useEffect, useRef, useState } from 'react';

/** Keep the user's text separate from the last usable numeric model value. */
export function DraftNumberInput({ value, onChange, onBlur, onKeyDown, required = true,
  step = 1, deferCommit = false, publishInvalid = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { deferCommit?: boolean; publishInvalid?: boolean }) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const published = useRef(String(value ?? ''));
  useEffect(() => {
    // A parent update caused by typing must never replace an unfinished draft.
    if (!editing && (String(value ?? '') !== published.current || (dirty && input.current?.validity.valid))) {
      setDraft(String(value ?? ''));
      setDirty(false);
    }
    published.current = String(value ?? '');
  }, [value, editing]);
  const publish = (event: React.ChangeEvent<HTMLInputElement>) => {
    const element = event.currentTarget;
    if (publishInvalid || (!element.value && !required) || (element.value.trim() && element.validity.valid)) onChange?.(event);
  };
  return <input {...props} ref={input} type="number" step={step} required={required}
    value={draft} data-numeric-draft="true" data-numeric-dirty={dirty ? 'true' : undefined}
    aria-invalid={dirty && input.current ? !input.current.validity.valid : undefined}
    onFocus={event => { setEditing(true); props.onFocus?.(event); }}
    onChange={event => {
      setDraft(event.target.value);
      setDirty(true);
      if (!deferCommit) publish(event);
    }}
    onBlur={event => {
      setEditing(false);
      if (deferCommit) publish(event as unknown as React.ChangeEvent<HTMLInputElement>);
      onBlur?.(event);
    }}
    onKeyDown={event => {
      if (event.key === 'Escape') {
        setDraft(String(value ?? ''));
        setDirty(false);
      }
      if (event.key === 'Enter' && !event.currentTarget.reportValidity()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onKeyDown?.(event);
    }} />;
}

/** Check edited drafts before actions; never silently submit their old model values. */
export function validateNumericDrafts(target: HTMLElement): boolean {
  const scope = target.closest('[data-numeric-scope]') ?? target.ownerDocument;
  const inputs = scope.querySelectorAll<HTMLInputElement>('input[data-numeric-dirty="true"]:not(:disabled)');
  for (const input of inputs) {
    if (input.closest('[data-numeric-scope]') !== (scope instanceof Element ? scope : null)) continue;
    if (!input.validity.valid) {
      input.focus();
      input.reportValidity();
      return false;
    }
  }
  return true;
}

export function NumericActionButton({ onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} onClick={event => {
    if (!validateNumericDrafts(event.currentTarget)) { event.preventDefault(); return; }
    onClick?.(event);
  }} />;
}
