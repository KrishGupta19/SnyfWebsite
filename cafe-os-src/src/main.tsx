import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Register service worker (vite-plugin-pwa handles this via virtual module)
// The import below is injected by vite-plugin-pwa at build time
// It is a no-op in development (devOptions.enabled = false)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // vite-plugin-pwa auto-registers via registerType: 'autoUpdate'
    // This is just a safety fallback log
    navigator.serviceWorker.getRegistrations().then(regs => {
      if (regs.length > 0) {
        console.log('[PWA] Service worker registered:', regs[0].scope);
      }
    });
  });
}