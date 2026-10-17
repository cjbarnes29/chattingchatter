import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Genvibe inspector is a third-party script with full access to the page, so it is only added while developing
// (never to the production build that people install).
const devInspector = {
  name: 'dev-inspector',
  apply: 'serve' as const,
  transformIndexHtml: () => [{ tag: 'script', attrs: { src: 'https://genvibe.pro/inspector-script.js?v=e2b-capture2' }, injectTo: 'head' as const }],
}

// https://vitejs.dev/config/
export default defineConfig({ server: { host: true, allowedHosts: true, hmr: { clientPort: 443, protocol: 'wss' }, headers: { 'Cross-Origin-Embedder-Policy': 'credentialless', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'cross-origin' } }, base: './', 
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  plugins: [react(), devInspector],
  optimizeDeps: {
    exclude: [],
  },
})
