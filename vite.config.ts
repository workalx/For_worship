/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'For Worship',
        short_name: 'For Worship',
        description: 'Пісні з акордами, тюнер і метроном для гітариста групи прославлення',
        lang: 'uk',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#0f1012',
        theme_color: '#0f1012',
        start_url: '.',
        scope: '.',
        // Android: виділити текст у браузері → «Поділитися» → For Worship.
        share_target: {
          action: './',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Індекс бібліотеки пісень — в офлайн-кеші з моменту встановлення (пошук без мережі).
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}', 'library/index.json'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Частини з повними піснями кешуються при першому відкритті. Назва містить хеш вмісту,
            // тож кеш ніколи не застаріває; старі версії витісняються.
            urlPattern: ({ url }) => /\/library\/songs-[^/]+\.json$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fw-library-songs',
              expiration: { maxEntries: 80 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'generativelanguage.googleapis.com',
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    globals: true,
  },
});
