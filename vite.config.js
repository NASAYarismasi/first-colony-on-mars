import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Entry screens for the menu, flight and Jezero colony.
export default defineConfig({
  base: './',
  // Full-mission sim tests take seconds; allow headroom when the machine is busy.
  test: { testTimeout: 30000 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        flight: resolve(import.meta.dirname, 'flight.html'),
        colony: resolve(import.meta.dirname, 'colony.html')
      }
    }
  }
});
