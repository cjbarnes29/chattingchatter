import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({ server: { host: true, allowedHosts: true, hmr: { clientPort: 443, protocol: 'wss' }, headers: { 'Cross-Origin-Embedder-Policy': 'credentialless', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'cross-origin' } }, base: './', 
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  plugins: [react()],
  optimizeDeps: {
    exclude: [],
  },
})
