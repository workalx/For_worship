/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { tesseractAssets } from './vite/tesseractAssets';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    tesseractAssets(),
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
        background_color: '#06070a',
        theme_color: '#06070a',
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
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}', 'tesseract/**/*.{js,gz}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
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
