import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
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
      },
      devOptions: {
        // Keep the SW out of `npm run dev` to avoid stale-cache confusion in development.
        enabled: false,
      },
    }),
  ],
});
