import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { shouldBuildDemo } from './demo-ignore-build.mjs';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'demo-ignore-build.mjs');

const exitCodeOf = ({ environment, message }) =>
  spawnSync(process.execPath, [SCRIPT], {
    env: { ...process.env, VERCEL_ENV: environment, VERCEL_GIT_COMMIT_MESSAGE: message },
    encoding: 'utf8',
  }).status;

describe('shouldBuildDemo', () => {
  it('builds production on a squashed release commit', () => {
    assert.equal(
      shouldBuildDemo({
        environment: 'production',
        message: 'chore(repo): release 0.27.12 (#2034)\n\nCo-Authored-By: Acme <dev@example.com>',
      }),
      true,
    );
  });

  it('builds production on a release subject without a PR number', () => {
    assert.equal(
      shouldBuildDemo({ environment: 'production', message: 'chore(repo): release 1.0.0' }),
      true,
    );
  });

  it('skips production on any other subject', () => {
    for (const message of [
      'feat(desktop): add the demo playground scene (#2040)',
      'chore(repo): bump version to 0.27.12',
      'chore(repo): release notes for 0.27.12',
      'chore(repo): release 0.27.12-rc.1 (#2034)',
      'Revert "chore(repo): release 0.27.12 (#2034)"',
      '',
    ]) {
      assert.equal(shouldBuildDemo({ environment: 'production', message }), false, message);
    }
  });

  it('skips production when Vercel sends no message', () => {
    assert.equal(shouldBuildDemo({ environment: 'production', message: undefined }), false);
  });

  it('always builds previews', () => {
    assert.equal(
      shouldBuildDemo({ environment: 'preview', message: 'fix(desktop): tidy the board' }),
      true,
    );
  });

  it('exits 1 to build and 0 to skip, as the Vercel ignore step expects', () => {
    assert.equal(
      exitCodeOf({ environment: 'production', message: 'chore(repo): release 0.27.12 (#2034)' }),
      1,
    );
    assert.equal(exitCodeOf({ environment: 'production', message: 'feat(desktop): demo' }), 0);
    assert.equal(exitCodeOf({ environment: 'preview', message: 'feat(desktop): demo' }), 1);
  });
});
