/// <reference types="vitest/config" />
import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from https://rj8228.github.io/galois/ on GitHub Pages.
export default defineConfig({
  base: '/galois/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Galois',
        short_name: 'Galois',
        description: "Learn group theory by turning a Rubik's cube.",
        theme_color: '#1e2a25',
        background_color: '#1e2a25',
        display: 'standalone',
        start_url: '/galois/',
        scope: '/galois/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell, the cube renderer and the scramble solver all work offline.
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Fonts are cached on first use, so only the looks you open are stored.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 80 } },
          },
        ],
      },
    }),
  ],
  // cubing.js loads its 3D renderer and solver lazily and runs search in a worker.
  worker: { format: 'es' },
  // The 3D renderer and the scramble solver are lazy chunks over 500 kB; the first screen stays small.
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
    modulePreload: false,
    // cubing.js's search worker shares chunks with the page. Nothing it imports may live in the
    // app entry, or the worker imports the entry and runs the app (which needs `document`). So the
    // preload helper and cubing.js's shared core (alg + helper chunks) get chunks of their own.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vite-preload', test: /preload-helper/ },
            {
              name: 'cubing-core',
              test: /node_modules[\\/]cubing[\\/]dist[\\/]lib[\\/]cubing[\\/](alg[\\/]|chunks[\\/]chunk-)/,
            },
          ],
        },
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
