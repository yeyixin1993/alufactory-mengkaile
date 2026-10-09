// Shared for the lifetime of this page, including route/account remounts.
// A fresh page load starts visible; returning home explicitly restores visibility.
let hidden = false;
const listeners = new Set<() => void>();
export const aiVisibility = {
  getSnapshot: () => hidden,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  setHidden: (value: boolean) => {
    if (hidden === value) return;
    hidden = value;
    listeners.forEach(listener => listener());
  },
};
