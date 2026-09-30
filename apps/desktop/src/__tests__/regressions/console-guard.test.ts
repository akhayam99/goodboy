// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DESKTOP_ROOT = join(import.meta.dirname, '..', '..', '..');
const RUN_TIMEOUT_MS = 120_000;
const SPAWN_TIMEOUT_MS = 90_000;

type AssertionResult = {
  readonly title: string;
  readonly status: string;
  readonly failureMessages: ReadonlyArray<string>;
};

type FileResult = {
  readonly name: string;
  readonly status: string;
  readonly message: string;
  readonly assertionResults: ReadonlyArray<AssertionResult>;
};

type JsonReport = { readonly testResults: ReadonlyArray<FileResult> };

type RunParams = { readonly extraEnv?: Record<string, string> };

const runFixtures = ({ extraEnv = {} }: RunParams = {}): ReadonlyArray<FileResult> => {
  const env = { ...process.env, ...extraEnv };
  if (extraEnv['GOODBOY_CONSOLE_REPORT'] === undefined) {
    delete env['GOODBOY_CONSOLE_REPORT'];
  }
  delete env['GOODBOY_UPDATE_CONSOLE_BASELINE'];
  const run = spawnSync(
    'pnpm',
    ['exec', 'vitest', 'run', '--config', 'vitest.console-guard.config.ts', '--reporter=json'],
    { cwd: DESKTOP_ROOT, env, encoding: 'utf8', timeout: SPAWN_TIMEOUT_MS },
  );
  const report: JsonReport = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')));
  return report.testResults;
};

type ByTitleParams = { results: ReadonlyArray<AssertionResult>; title: string };

const byTitle = ({ results, title }: ByTitleParams): AssertionResult => {
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
      const results = runFixtures().flatMap((file) => file.assertionResults);

      const error = byTitle({ results, title: 'logs output that is not in the baseline' });
      expect(error.status).toBe('failed');
      expect(error.failureMessages.join('\n')).toContain(
        'console.error: unexpected fixture error #',
      );

      const warning = byTitle({ results, title: 'warns about output that is not in the baseline' });
      expect(warning.status).toBe('failed');
      expect(warning.failureMessages.join('\n')).toContain(
        'console.warn: unexpected fixture warning',
      );

      expect(byTitle({ results, title: 'stays quiet' }).status).toBe('passed');
      expect(
        byTitle({ results, title: 'may spy on the console itself and log through the spy' }).status,
      ).toBe('passed');
    },
    RUN_TIMEOUT_MS,
  );

  it(
    'fails a test that leaves a db call or an invoke command unstubbed, and names it',
    () => {
      const results = runFixtures().flatMap((file) => file.assertionResults);

      const db = byTitle({ results, title: 'calls a db function nobody stubbed' });
      expect(db.status).toBe('failed');
      expect(db.failureMessages.join('\n')).toContain('db: countUserTextEvents(');

      const invoke = byTitle({ results, title: 'calls an invoke command nobody stubbed' });
      expect(invoke.status).toBe('failed');
      expect(invoke.failureMessages.join('\n')).toContain('invoke: workspace_script_list_live(');

      expect(byTitle({ results, title: 'stubs what it calls' }).status).toBe('passed');
      expect(
        byTitle({
          results,
          title: 'drains the record itself when the call is the point of the test',
        }).status,
      ).toBe('passed');
    },
    RUN_TIMEOUT_MS,
  );

  it(
    'fails the file when output arrives outside a test',
    () => {
      const late = runFixtures().find((file) => file.name.endsWith('late-output.fixture.ts'));

      expect(late?.status).toBe('failed');
      expect(late?.message).toContain('outside a test');
      expect(late?.message).toContain('late fixture output');
    },
    RUN_TIMEOUT_MS,
  );

  it(
    'refuses to run when GOODBOY_CONSOLE_REPORT is set without the update switch',
    () => {
      const results = runFixtures({ extraEnv: { GOODBOY_CONSOLE_REPORT: '/dev/null' } });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((file) => file.status === 'failed')).toBe(true);
    },
    RUN_TIMEOUT_MS,
  );
});
