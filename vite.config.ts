/// <reference types="vitest/config" />
import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

// Served from https://rj8228.github.io/galois/ on GitHub Pages.
export default defineConfig({
  base: '/galois/',
  plugins: [preact()],
  // cubing.js loads its 3D renderer and solver lazily and runs search in a worker.
  worker: { format: 'es' },
  // The 3D renderer and the scramble solver are lazy chunks over 500 kB; the first screen stays small.
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
    modulePreload: false,
    // cubing.js's search worker shares chunks with the page. Vite's preload helper must not
    // live in the app entry, or the worker imports the entry and runs the app (which needs `document`).
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'vite-preload', test: /preload-helper/ }] } },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
