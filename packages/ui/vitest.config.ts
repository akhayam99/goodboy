import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    maxWorkers: process.env.CI === undefined ? 2 : undefined,
    setupFiles: ['src/test/failOnConsole.ts'],
  },
});
