import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/regressions/console-guard/*.fixture.ts'],
    setupFiles: ['src/test/failOnConsole.ts'],
  },
});
