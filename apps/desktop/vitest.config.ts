import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const A11Y_TESTS = 'src/__tests__/a11y/**';
const PERF_TESTS = '**/*.perf.test.{ts,tsx}';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    environment: 'happy-dom',
    passWithNoTests: true,
    silent: 'passed-only',
    testTimeout: 15000,
    hookTimeout: 15000,
    setupFiles: [
      'src/test/failOnConsole.ts',
      'src/test/failOnUnexpectedCalls.ts',
      'src/test/dbBootDouble.ts',
    ],
    globalSetup: ['src/test/consoleBaselineReport.ts'],
    css: { include: [/\.css\?raw$/] },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          exclude: ['**/node_modules/**', A11Y_TESTS, PERF_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: 'perf',
          include: [PERF_TESTS],
          exclude: ['**/node_modules/**'],
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
