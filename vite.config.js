import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/contractor-photos-app/',
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'assets/*'],
      manifest: false, // We already have a public/manifest.json, so we can tell it to use that or we can let it know not to generate one to avoid overwriting. Actually, VitePWA usually manages the manifest, but setting manifest: false might prevent it from generating one. We'll set it to false and let the existing manifest.json in public/ be used, but we MUST inject the manifest link. Wait, if we use the existing manifest, PWA plugin will just cache it. It's usually better to let VitePWA handle the manifest, but I'll skip manifest generation here or just define it minimally if needed.
      // Wait, let's just use `injectRegister: 'auto'` (default)
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 5000000 // 5MB
      },
      devOptions: {
        enabled: true, // Enable service worker in development mode so they can test it on their phone
        type: 'module',
      }
    })
  ],
})
