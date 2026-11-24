import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { websiteBuildDecisionOf } from './website-ignore-build.mjs';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'website-ignore-build.mjs');
const MERGE_BASE = 'a'.repeat(40);
const LAST_DEPLOY = 'b'.repeat(40);

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

const preview = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'ak/hero-copy' };
const production = { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' };

describe('websiteBuildDecisionOf', () => {
  it('builds production on main when the site inputs changed since the last deploy', () => {
    const { git, calls } = gitOf({ diffStatus: 1, hasLastDeploy: true });
    const env = { ...production, VERCEL_GIT_PREVIOUS_SHA: LAST_DEPLOY };
    assert.equal(websiteBuildDecisionOf({ env, git }).shouldBuild, true);
    const diff = diffOf({ calls });
    assert.equal(diff[2], LAST_DEPLOY);
    for (const path of ['website', 'CHANGELOG.md', 'FEATURES.md', 'docs/features']) {
      assert.ok(diff.includes(path), path);
    }
  });

  it('skips production on main when nothing the site reads changed', () => {
    const { git } = gitOf({ diffStatus: 0, hasLastDeploy: true });
    const env = { ...production, VERCEL_GIT_PREVIOUS_SHA: LAST_DEPLOY };
    assert.equal(websiteBuildDecisionOf({ env, git }).shouldBuild, false);
  });

  it('builds production on main with no last deploy, or one missing from the clone', () => {
    for (const previousSha of [undefined, '', LAST_DEPLOY]) {
      const { git, calls } = gitOf({ diffStatus: 0 });
      const env = { ...production, VERCEL_GIT_PREVIOUS_SHA: previousSha };
      assert.equal(websiteBuildDecisionOf({ env, git }).shouldBuild, true, String(previousSha));
      assert.equal(
        calls.some((args) => args[0] === 'fetch'),
        false,
      );
    }
  });

  it('skips a new preview branch that leaves the site inputs alone', () => {
    const { git, calls } = gitOf({ diffStatus: 0 });
    assert.equal(websiteBuildDecisionOf({ env: preview, git }).shouldBuild, false);
    assert.equal(diffOf({ calls })[2], MERGE_BASE);
  });

  it('builds a new preview branch that changes the site', () => {
    const { git } = gitOf({ diffStatus: 1 });
    assert.equal(websiteBuildDecisionOf({ env: preview, git }).shouldBuild, true);
  });

  it('builds a new preview branch when the merge base cannot be found', () => {
    const { git } = gitOf({ diffStatus: 0, hasMergeBase: false });
    assert.equal(websiteBuildDecisionOf({ env: preview, git }).shouldBuild, true);
  });

  it('diffs a later preview push against the last deployed commit of the branch', () => {
    const { git, calls } = gitOf({ diffStatus: 0, hasLastDeploy: true });
    const env = { ...preview, VERCEL_GIT_PREVIOUS_SHA: LAST_DEPLOY };
    assert.equal(websiteBuildDecisionOf({ env, git }).shouldBuild, false);
    assert.equal(diffOf({ calls })[2], LAST_DEPLOY);
  });

  it('exits 1 to build when production has no last deploy', () => {
    const { status } = spawnSync(process.execPath, [SCRIPT], {
      env: { ...process.env, ...production, VERCEL_GIT_PREVIOUS_SHA: '' },
      encoding: 'utf8',
    });
    assert.equal(status, 1);
  });
});
