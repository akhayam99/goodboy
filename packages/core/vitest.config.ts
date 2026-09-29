import { defineConfig } from 'vitest/config';

const PERF_TESTS = '**/*.perf.test.ts';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          exclude: ['**/node_modules/**', PERF_TESTS],
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
    ],
  },
});
