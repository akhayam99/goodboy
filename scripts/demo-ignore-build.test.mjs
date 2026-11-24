import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { demoBuildDecisionOf } from './demo-ignore-build.mjs';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'demo-ignore-build.mjs');
const MERGE_BASE = 'a'.repeat(40);
const LAST_DEPLOY = 'b'.repeat(40);

const exitCodeOf = ({ environment, message }) =>
  spawnSync(process.execPath, [SCRIPT], {
    env: { ...process.env, VERCEL_ENV: environment, VERCEL_GIT_COMMIT_MESSAGE: message },
    encoding: 'utf8',
  }).status;

const gitOf = ({ diffStatus, hasMergeBase = true, hasLastDeploy = false }) => {
  const calls = [];
  const git = ({ args }) => {
    calls.push(args);
    const [command] = args;
    if (command === 'cat-file') {
      return { status: hasLastDeploy ? 0 : 1, stdout: '' };
    }
    if (command === 'remote') {
      return { status: 0, stdout: 'origin' };
    }
    if (command === 'rev-parse') {
      return { status: 0, stdout: 'true' };
    }
    if (command === 'fetch') {
      return { status: 0, stdout: '' };
    }
    if (command === 'merge-base') {
      return { status: hasMergeBase ? 0 : 1, stdout: hasMergeBase ? MERGE_BASE : '' };
    }
    if (command === 'diff') {
      return { status: diffStatus, stdout: '' };
    }
    return { status: 128, stdout: '' };
  };
  return { git, calls };
};

const diffOf = ({ calls }) => calls.find((args) => args[0] === 'diff');

const preview = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'ak/board-tidy' };

describe('demoBuildDecisionOf', () => {
  it('builds production on a squashed release commit', () => {
    const { git } = gitOf({ diffStatus: 0 });
    const decision = demoBuildDecisionOf({
      env: {
        VERCEL_ENV: 'production',
        VERCEL_GIT_COMMIT_MESSAGE:
          'chore(repo): release 0.27.12 (#2034)\n\nCo-Authored-By: Acme <dev@example.com>',
      },
      git,
    });
    assert.equal(decision.shouldBuild, true);
  });

  it('builds production on a release subject without a PR number', () => {
    const { git } = gitOf({ diffStatus: 0 });
    const decision = demoBuildDecisionOf({
      env: { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_MESSAGE: 'chore(repo): release 1.0.0' },
      git,
    });
    assert.equal(decision.shouldBuild, true);
  });

  it('skips production on any other subject, whatever it changed', () => {
    for (const message of [
      'feat(desktop): add the demo playground scene (#2040)',
      'chore(repo): bump version to 0.27.12',
      'chore(repo): release notes for 0.27.12',
      'chore(repo): release 0.27.12-rc.1 (#2034)',
      'Revert "chore(repo): release 0.27.12 (#2034)"',
      '',
    ]) {
      const { git, calls } = gitOf({ diffStatus: 1 });
      const decision = demoBuildDecisionOf({
        env: { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_MESSAGE: message },
        git,
      });
      assert.equal(decision.shouldBuild, false, message);
      assert.equal(calls.length, 0, message);
    }
  });

  it('skips production when Vercel sends no message', () => {
    const { git } = gitOf({ diffStatus: 1 });
    assert.equal(
      demoBuildDecisionOf({ env: { VERCEL_ENV: 'production' }, git }).shouldBuild,
      false,
    );
  });

  it('builds a new preview branch that changes what the demo shows', () => {
    const { git, calls } = gitOf({ diffStatus: 1 });
    assert.equal(demoBuildDecisionOf({ env: preview, git }).shouldBuild, true);
    const diff = diffOf({ calls });
    assert.equal(diff[2], MERGE_BASE);
    for (const path of [
      'apps/desktop/src',
      'apps/desktop/index.html',
      ':(glob)packages/*/src/**',
      'apps/desktop/vercel.json',
      'apps/desktop/vite.config.ts',
      'pnpm-lock.yaml',
    ]) {
      assert.ok(diff.includes(path), path);
    }
  });

  it('skips a new preview branch that leaves the demo inputs alone', () => {
    const { git } = gitOf({ diffStatus: 0 });
    assert.equal(demoBuildDecisionOf({ env: preview, git }).shouldBuild, false);
  });

  it('builds a preview when the merge base with main cannot be found', () => {
    const { git } = gitOf({ diffStatus: 0, hasMergeBase: false });
    assert.equal(demoBuildDecisionOf({ env: preview, git }).shouldBuild, true);
  });

  it('builds a preview when git diff fails', () => {
    const { git } = gitOf({ diffStatus: 128 });
    assert.equal(demoBuildDecisionOf({ env: preview, git }).shouldBuild, true);
  });

  it('diffs a later push against the last deployed commit of the branch', () => {
    const env = { ...preview, VERCEL_GIT_PREVIOUS_SHA: LAST_DEPLOY };
    const unchanged = gitOf({ diffStatus: 0, hasLastDeploy: true });
    assert.equal(demoBuildDecisionOf({ env, git: unchanged.git }).shouldBuild, false);
    assert.equal(diffOf({ calls: unchanged.calls })[2], LAST_DEPLOY);
    const changed = gitOf({ diffStatus: 1, hasLastDeploy: true });
    assert.equal(demoBuildDecisionOf({ env, git: changed.git }).shouldBuild, true);
  });

  it('uses the merge base when the last deployed commit is missing from the clone', () => {
    const { git, calls } = gitOf({ diffStatus: 0 });
    const env = { ...preview, VERCEL_GIT_PREVIOUS_SHA: LAST_DEPLOY };
    assert.equal(demoBuildDecisionOf({ env, git }).shouldBuild, false);
    assert.equal(diffOf({ calls })[2], MERGE_BASE);
  });

  it('exits 1 to build and 0 to skip, as the Vercel ignore step expects', () => {
    assert.equal(
      exitCodeOf({ environment: 'production', message: 'chore(repo): release 0.27.12 (#2034)' }),
      1,
    );
    assert.equal(exitCodeOf({ environment: 'production', message: 'feat(desktop): demo' }), 0);
  });
});
