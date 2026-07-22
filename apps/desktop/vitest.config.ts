import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    passWithNoTests: true,
    testTimeout: 15000,
    exclude: ['**/node_modules/**', '**/a11y/**'],
  },
});
