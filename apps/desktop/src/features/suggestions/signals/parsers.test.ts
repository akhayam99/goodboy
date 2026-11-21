// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { actionsJobOf } from './actionsJobOf';
import { failingTestOf } from './failingTestOf';
import { hostOf } from './hostOf';
import { isDestructiveScript } from './isDestructiveScript';
import { isTimeoutLog } from './isTimeoutLog';
import { nextScriptRulesOf } from './nextScriptRulesOf';
import { shellQuote } from './shellQuote';

describe('failingTestOf', () => {
  it('reads a vitest or jest file from a FAIL line', () => {
    expect(failingTestOf({ log: ' FAIL  src/ledger/rounding.test.ts > rounds half up' })).toEqual({
      file: 'src/ledger/rounding.test.ts',
      name: null,
    });
  });

  it('reads a pytest node, a go test and a cargo test', () => {
    expect(failingTestOf({ log: 'FAILED tests/test_ledger.py::test_rounding - boom' })).toEqual({
      file: 'tests/test_ledger.py',
      name: 'test_rounding',
    });
    expect(failingTestOf({ log: '--- FAIL: TestRounding (0.00s)' })).toEqual({
      file: null,
      name: 'TestRounding',
    });
    expect(failingTestOf({ log: 'test ledger::rounding::half_up ... FAILED' })).toEqual({
      file: null,
      name: 'ledger::rounding::half_up',
    });
  });

  it('ignores colour codes and finds nothing when no test is named', () => {
    expect(failingTestOf({ log: '\u001B[31mFAIL\u001B[0m  src/a.spec.ts' })?.file).toBe(
      'src/a.spec.ts',
    );
    expect(failingTestOf({ log: 'Error: connection refused' })).toBeNull();
  });

  it('does not take a path that is not a test file', () => {
    expect(failingTestOf({ log: 'FAIL  ../../etc/passwd' })).toBeNull();
  });
});

describe('isTimeoutLog', () => {
  it('knows the ways a job says it timed out', () => {
    expect(
      isTimeoutLog({
        log: 'The job running on runner GitHub Actions 3 has exceeded the maximum execution time of 360 minutes.',
      }),
    ).toBe(true);
    expect(isTimeoutLog({ log: 'step timed out after 600 seconds' })).toBe(true);
    expect(isTimeoutLog({ log: 'connect ETIMEDOUT 10.0.0.1:5432' })).toBe(true);
  });

  it('does not call a failing assertion a timeout', () => {
    expect(isTimeoutLog({ log: 'expected 10.01 to equal 10.00' })).toBe(false);
  });
});

describe('nextScriptRulesOf', () => {
  it('maps migrations, lockfiles and schemas to their rule', () => {
    expect(
      nextScriptRulesOf({
        paths: ['db/migrations/0042_a.sql', 'pnpm-lock.yaml', 'prisma/schema.prisma', 'src/x.ts'],
      }).map((hit) => hit.rule),
    ).toEqual(['lockfile', 'schema', 'migrations']);
  });

  it('finds nothing in plain source', () => {
    expect(nextScriptRulesOf({ paths: ['src/a.ts', 'README.md'] })).toEqual([]);
  });
});

describe('small helpers', () => {
  it('reads the run and the job of an Actions url, and nothing else', () => {
    expect(
      actionsJobOf({ detailsUrl: 'https://github.com/acme/ledger-core/actions/runs/9/job/4' }),
    ).toEqual({
      runId: '9',
      jobId: '4',
    });
    expect(actionsJobOf({ detailsUrl: 'https://ci.harborline.dev/builds/1' })).toBeNull();
    expect(actionsJobOf({ detailsUrl: null })).toBeNull();
  });

  it('names the host of a link without its www', () => {
    expect(hostOf({ url: 'https://www.ci.harborline.dev/builds/1?x=1' })).toBe('ci.harborline.dev');
    expect(hostOf({ url: 'not a url' })).toBeNull();
  });

  it('calls migrate, seed, deploy and clean scripts destructive', () => {
    for (const name of ['db:migrate', 'seed', 'deploy:prod', 'clean', 'db:push']) {
      expect(isDestructiveScript({ name })).toBe(true);
    }
    for (const name of ['install', 'db:generate', 'build', 'test']) {
      expect(isDestructiveScript({ name })).toBe(false);
    }
  });

  it('quotes anything that is not a plain word and drops control characters', () => {
    expect(shellQuote({ text: 'src/a.test.ts' })).toBe('src/a.test.ts');
    expect(shellQuote({ text: 'a b' })).toBe("'a b'");
    expect(shellQuote({ text: 'a\nb' })).toBe("'a b'");
  });
});
