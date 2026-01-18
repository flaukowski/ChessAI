import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[App] Service workers not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      updateViaCache: 'none'
    });
    
    console.log('[App] SW registered');

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[App] New SW installed, reloading...');
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[App] New SW activated, refreshing page');
      window.location.reload();
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_ACTIVATED') {
        console.log('[App] SW activated version:', event.data.version);
      }
    });

    await registration.update();
    console.log('[App] SW update check completed');

    setInterval(() => {
      registration.update();
    }, 60000);

  } catch (error) {
    console.error('[App] SW registration failed:', error);
  }
}

registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
