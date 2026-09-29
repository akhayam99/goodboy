import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DESKTOP_ROOT = join(import.meta.dirname, '..', '..', '..');
const RUN_TIMEOUT_MS = 120_000;

type AssertionResult = {
  readonly title: string;
  readonly status: string;
  readonly failureMessages: ReadonlyArray<string>;
};

type JsonReport = {
  readonly testResults: ReadonlyArray<{
    readonly assertionResults: ReadonlyArray<AssertionResult>;
  }>;
};

const runFixture = (): ReadonlyArray<AssertionResult> => {
  const env = { ...process.env };
  delete env['GOODBOY_CONSOLE_REPORT'];
  delete env['GOODBOY_UPDATE_CONSOLE_BASELINE'];
  const run = spawnSync(
    'pnpm',
    ['exec', 'vitest', 'run', '--config', 'vitest.console-guard.config.ts', '--reporter=json'],
    { cwd: DESKTOP_ROOT, env, encoding: 'utf8' },
  );
  const report: JsonReport = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')));
  return report.testResults.flatMap((file) => file.assertionResults);
};

const byTitle = (results: ReadonlyArray<AssertionResult>, title: string): AssertionResult => {
  const found = results.find((result) => result.title === title);
  if (found === undefined) {
    throw new Error(`fixture test not found: ${title}`);
  }
  return found;
};

describe('failOnConsole', () => {
  it(
    'fails the test that logs an unexpected console.error or console.warn, and only that one',
    () => {
      const results = runFixture();

      const error = byTitle(results, 'logs output that is not in the baseline');
      expect(error.status).toBe('failed');
      expect(error.failureMessages.join('\n')).toContain(
        'console.error: unexpected fixture error #',
      );

      const warning = byTitle(results, 'warns about output that is not in the baseline');
      expect(warning.status).toBe('failed');
      expect(warning.failureMessages.join('\n')).toContain(
        'console.warn: unexpected fixture warning',
      );

      expect(byTitle(results, 'stays quiet').status).toBe('passed');
      expect(byTitle(results, 'may spy on the console itself and log through the spy').status).toBe(
        'passed',
      );
    },
    RUN_TIMEOUT_MS,
  );
});
