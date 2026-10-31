import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { demoPlugins } from './vite/demoHtml';
import { xtermFrozenPrototype } from './vite/xtermFrozenPrototype';

const host = process.env.TAURI_DEV_HOST;
const port = process.env.VITE_PORT ? Number(process.env.VITE_PORT) : 1421;
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), xtermFrozenPrototype(), ...demoPlugins({ mode })],
  clearScreen: false,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    port,
    strictPort: true,
    host: host ?? false,
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
  },
}));
