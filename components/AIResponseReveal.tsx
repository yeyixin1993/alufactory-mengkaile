import React, { useEffect, useRef, useState } from 'react';

/** Animate only freshly received replies; restored history is immediately readable. */
export default function AIResponseReveal({ text, animate, children }: { text: string; animate: boolean; children?: React.ReactNode }) {
  const characters = Array.from(text);
  const [visible, setVisible] = useState(animate ? 0 : characters.length);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!animate) {
      setVisible(Array.from(text).length);
      return;
    }
    const count = Array.from(text).length;
    let shown = 0;
    setVisible(0);
    // Reveal text at a readable pace, including short quote introductions.
    const step = Math.max(1, Math.ceil(count / 720));
    let frame = 0;
    const timer = window.setInterval(() => {
      const log = root.current?.closest('#ai-conversation');
      const follow = !!log && log.scrollHeight - log.scrollTop - log.clientHeight < 100;
      shown = Math.min(count, shown + step);
      setVisible(shown);
      if (follow && shown < count) frame = requestAnimationFrame(() => { if (log) log.scrollTop = log.scrollHeight; });
      if (shown >= count) window.clearInterval(timer);
    }, Math.max(32, Math.ceil(1200 / Math.max(count, 1))));
    return () => { window.clearInterval(timer); cancelAnimationFrame(frame); };
  }, [text, animate]);
  const complete = visible >= characters.length;
  return <div ref={root} aria-busy={!complete}>
    <p>{characters.slice(0, visible).join('')}{!complete && <span className="ai-response-cursor" aria-hidden="true" />}</p>
    {complete && children}
  </div>;
}
