import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { changedSinceBaseOf } from './changedSinceBaseOf.mjs';
import { gitRunnerOf } from './gitRunnerOf.mjs';

const IDENTITY = [
  '-c',
  'user.name=Acme',
  '-c',
  'user.email=dev@example.com',
  '-c',
  'commit.gpgsign=false',
];

const gitIn = ({ cwd, args }) => {
  const result = spawnSync('git', [...IDENTITY, ...args], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

const commitFile = ({ cwd, path, text }) => {
  mkdirSync(dirname(join(cwd, path)), { recursive: true });
  writeFileSync(join(cwd, path), text);
  gitIn({ cwd, args: ['add', '-A'] });
  gitIn({ cwd, args: ['commit', '-q', '-m', `edit ${path}`] });
  return gitIn({ cwd, args: ['rev-parse', 'HEAD'] });
};

const cloneOf = ({ root, remoteUrl, name, branch, depth }) => {
  const cwd = join(root, name);
  const shallow = depth == null ? [] : [`--depth=${depth}`];
  gitIn({ cwd: root, args: ['clone', '-q', ...shallow, '--branch', branch, remoteUrl, cwd] });
  return cwd;
};

describe('changedSinceBaseOf on a real clone', () => {
  const fixture = {};

  before(() => {
    const root = mkdtempSync(join(tmpdir(), 'goodboy-vercel-ignore-'));
    const source = join(root, 'source');
    mkdirSync(source);
    gitIn({ cwd: source, args: ['init', '-q', '-b', 'main'] });
    commitFile({ cwd: source, path: 'site/page.txt', text: 'harborline' });
    commitFile({ cwd: source, path: 'packages/ui/src/row.ts', text: 'northwind' });
    commitFile({ cwd: source, path: 'packages/ui/README.md', text: 'acme' });
    gitIn({ cwd: source, args: ['checkout', '-q', '-b', 'ak/docs-only'] });
    commitFile({ cwd: source, path: 'packages/ui/README.md', text: 'cascadia' });
    commitFile({ cwd: source, path: 'notes/plan.txt', text: 'ledger-core' });
    commitFile({ cwd: source, path: 'notes/plan.txt', text: 'notify-relay' });
    gitIn({ cwd: source, args: ['checkout', '-q', 'main'] });
    gitIn({ cwd: source, args: ['checkout', '-q', '-b', 'ak/ui-row'] });
    const firstRowEdit = commitFile({
      cwd: source,
      path: 'packages/ui/src/row.ts',
      text: 'payments-api',
    });
    const docsAfterRow = commitFile({ cwd: source, path: 'notes/plan.txt', text: 'acme' });
    gitIn({ cwd: source, args: ['checkout', '-q', 'main'] });
    commitFile({ cwd: source, path: 'site/page.txt', text: 'northwind' });
    commitFile({ cwd: source, path: 'site/page.txt', text: 'cascadia' });
    const remote = join(root, 'remote.git');
    gitIn({ cwd: root, args: ['clone', '-q', '--bare', source, remote] });
    Object.assign(fixture, {
      root,
      remoteUrl: pathToFileURL(remote).href,
      firstRowEdit,
      docsAfterRow,
    });
  });

  after(() => {
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it('skips a new branch that changes nothing under the paths, after deepening a shallow clone', () => {
    const cwd = cloneOf({ ...fixture, name: 'docs-shallow', branch: 'ak/docs-only', depth: 1 });
    const decision = changedSinceBaseOf({
      env: { VERCEL_GIT_COMMIT_REF: 'ak/docs-only' },
      paths: ['site', ':(glob)packages/*/src/**'],
      git: gitRunnerOf({ cwd }),
    });
    assert.equal(decision.shouldBuild, false, decision.reason);
    assert.match(decision.reason, /merge base [0-9a-f]{7} with origin\/main/);
  });

  it('builds a new branch that changes a file a glob path matches', () => {
    const cwd = cloneOf({ ...fixture, name: 'row-shallow', branch: 'ak/ui-row', depth: 1 });
    const decision = changedSinceBaseOf({
      env: { VERCEL_GIT_COMMIT_REF: 'ak/ui-row' },
      paths: ['site', ':(glob)packages/*/src/**'],
      git: gitRunnerOf({ cwd }),
    });
    assert.equal(decision.shouldBuild, true, decision.reason);
  });

  it('diffs against the last deploy when its commit is in the clone', () => {
    const cwd = cloneOf({ ...fixture, name: 'row-full', branch: 'ak/ui-row' });
    const paths = [':(glob)packages/*/src/**'];
    const git = gitRunnerOf({ cwd });
    const sinceRowEdit = changedSinceBaseOf({
      env: { VERCEL_GIT_COMMIT_REF: 'ak/ui-row', VERCEL_GIT_PREVIOUS_SHA: fixture.firstRowEdit },
      paths,
      git,
    });
    assert.equal(sinceRowEdit.shouldBuild, false, sinceRowEdit.reason);
    const sinceParent = changedSinceBaseOf({
      env: {
        VERCEL_GIT_COMMIT_REF: 'ak/ui-row',
        VERCEL_GIT_PREVIOUS_SHA: `${fixture.firstRowEdit}~1`,
      },
      paths,
      git,
    });
    assert.equal(sinceParent.shouldBuild, true, sinceParent.reason);
  });

  it('falls back to the merge base when the last deploy is missing from the clone', () => {
    const cwd = cloneOf({ ...fixture, name: 'docs-missing', branch: 'ak/docs-only', depth: 1 });
    const decision = changedSinceBaseOf({
      env: { VERCEL_GIT_COMMIT_REF: 'ak/docs-only', VERCEL_GIT_PREVIOUS_SHA: 'f'.repeat(40) },
      paths: ['site'],
      git: gitRunnerOf({ cwd }),
    });
    assert.equal(decision.shouldBuild, false, decision.reason);
  });

  it('builds main when no earlier deploy is in the clone', () => {
    const cwd = cloneOf({ ...fixture, name: 'main-shallow', branch: 'main', depth: 1 });
    const decision = changedSinceBaseOf({
      env: { VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_PREVIOUS_SHA: '' },
      paths: ['site'],
      git: gitRunnerOf({ cwd }),
    });
    assert.equal(decision.shouldBuild, true, decision.reason);
  });

  it('builds when no remote is reachable to find the merge base', () => {
    const cwd = cloneOf({ ...fixture, name: 'docs-no-remote', branch: 'ak/docs-only', depth: 1 });
    gitIn({ cwd, args: ['remote', 'remove', 'origin'] });
    const decision = changedSinceBaseOf({
      env: { VERCEL_GIT_COMMIT_REF: 'ak/docs-only' },
      paths: ['site'],
      git: gitRunnerOf({ cwd }),
    });
    assert.equal(decision.shouldBuild, true, decision.reason);
    assert.match(decision.reason, /no merge base/);
  });

  it('builds when the remote fetch fails', () => {
    const cwd = cloneOf({ ...fixture, name: 'docs-bad-remote', branch: 'ak/docs-only', depth: 1 });
    gitIn({
      cwd,
      args: ['remote', 'set-url', 'origin', pathToFileURL(join(fixture.root, 'gone.git')).href],
    });
    const decision = changedSinceBaseOf({
      env: { VERCEL_GIT_COMMIT_REF: 'ak/docs-only' },
      paths: ['site'],
      git: gitRunnerOf({ cwd }),
    });
    assert.equal(decision.shouldBuild, true, decision.reason);
  });

  it('reaches GitHub by the repository Vercel names when the clone has no origin', () => {
    const calls = [];
    const git = ({ args }) => {
      calls.push(args);
      if (args[0] === 'remote') {
        return { status: 2, stdout: '' };
      }
      return { status: 128, stdout: '' };
    };
    changedSinceBaseOf({
      env: {
        VERCEL_GIT_COMMIT_REF: 'ak/docs-only',
        VERCEL_GIT_PROVIDER: 'github',
        VERCEL_GIT_REPO_OWNER: 'acme',
        VERCEL_GIT_REPO_SLUG: 'harborline',
      },
      paths: ['site'],
      git,
    });
    const fetch = calls.find((args) => args[0] === 'fetch');
    assert.ok(fetch.includes('https://github.com/acme/harborline.git'), fetch.join(' '));
  });
});
