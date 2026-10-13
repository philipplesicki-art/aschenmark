import { defineConfig } from 'vite';

// Relative Pfade, damit dist/index.html auch per file:// in Electron läuft.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2020', sourcemap: false },
  server: { port: 5173 }
});
