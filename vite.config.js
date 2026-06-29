import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  // The `@` → src alias (previously supplied by the Base44 vite plugin).
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Precache both the scalable SVGs (Android/Chrome/desktop) and the branded
      // PNGs (iOS home-screen + broadest install compatibility) so install and
      // offline work everywhere. See docs/cloudflare-deployment.md.
      includeAssets: [
        'favicon.svg', 'icon.svg', 'maskable-icon.svg',
        'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png',
        'pwa-maskable-192.png', 'pwa-maskable-512.png',
      ],
      manifest: {
        name: 'CCG Connect',
        short_name: 'CCG Connect',
        description: 'Private job-management platform for Cook Construction Growth.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#13161B',
        theme_color: '#F98015',
        // PNGs first for the widest install compatibility; SVGs as scalable fallback.
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'maskable-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell only. Client-side routes fall back to index.html,
        // but API/auth calls must always hit the network — never serve them from cache.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,ico,woff,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Some bundles (e.g. three.js) are large; raise the precache size ceiling.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // API reads: network-first so online users always get fresh data,
            // but the last successful response is served when offline.
            urlPattern: ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ccg-api-get',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Map tiles: cache-first so the coverage map works offline and loads fast.
            urlPattern: ({ url }) => url.hostname.endsWith('tile.openstreetmap.org'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Keep the SW out of `npm run dev` to avoid stale-cache confusion in development.
        enabled: false,
      },
    }),
  ],
});
