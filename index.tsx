import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// The critical HTML loader is visible before the application bundle finishes
// downloading. Remove it only after React has committed and the browser has
// painted the first real application frame.
window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => {
    (window as any).__MENGKAILE_LOADING__?.complete?.();
  });
});
