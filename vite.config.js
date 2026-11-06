import { cpSync, existsSync } from 'node:fs';
import { defineConfig } from 'vite';

/**
 * Los scripts de la app son "clásicos" (comparten ámbito global para que
 * funcionen los onclick inline), así que Vite no los empaqueta. Los copiamos
 * tal cual al build para que dist/ sea autocontenido.
 */
function copyClassicAssets() {
  return {
    name: 'copy-classic-assets',
    apply: 'build',
    closeBundle() {
      for (const dir of ['src', 'pages', 'assets']) {
        if (existsSync(dir)) cpSync(dir, `dist/${dir}`, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: false,
  plugins: [copyClassicAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
  },
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
