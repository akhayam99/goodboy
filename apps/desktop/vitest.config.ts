import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const A11Y_TESTS = 'src/__tests__/a11y/**';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    passWithNoTests: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    css: { include: [/\.css\?raw$/] },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          exclude: ['**/node_modules/**', A11Y_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: 'a11y',
          include: [`${A11Y_TESTS}/*.test.{ts,tsx}`],
          exclude: ['**/node_modules/**'],
        },
      },
    ],
  },
});
