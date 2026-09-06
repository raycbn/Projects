import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import '@/styles/index.css'
import App from '@/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Native only: light status-bar icons on PedalMap's dark brand and dismiss the
// splash screen once the first frame is painted. No-op on web (PWA).
if (Capacitor.getPlatform() === 'android') {
  void (async () => {
    try {
      const { StatusBar, StatusBarStyle } = await import('@capacitor/status-bar')
      await StatusBar.setStyle({ style: StatusBarStyle.Light })
      await StatusBar.setBackgroundColor({ color: '#0d3b2b' })
    } catch {
      /* status bar optional */
    }
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen')
      await SplashScreen.hide()
    } catch {
      /* splash optional */
    }
  })()
}

const CANONICAL_HOSTS = new Set(['pedalmap.es', 'localhost', '127.0.0.1'])

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Never install a SW on legacy Firebase hosts — it would fight the apex redirect.
    if (!CANONICAL_HOSTS.has(location.hostname)) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister()
      })
      return
    }
    void navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Pull the SW that bypasses /__/auth as soon as possible.
        void reg.update()
      })
      .catch((err) => {
        console.warn('[sw]', err)
      })
  })
}
