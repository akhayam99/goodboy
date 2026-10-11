import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = resolve(REPO, 'scripts/check-doc-refs.mjs');
const MAX_RECIPE_LINES = 40;

const runOn = ({ root }) =>
  spawnSync('node', [SCRIPT], { env: { ...process.env, DOC_REFS_ROOT: root }, encoding: 'utf8' });

const makeFixture = ({ doc }) => {
  const root = mkdtempSync(join(tmpdir(), 'doc-refs-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  mkdirSync(join(root, 'apps/desktop/src/features/live'), { recursive: true });
  writeFileSync(join(root, 'apps/desktop/src/features/live/a.ts'), 'export const a = 1;\n');
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs/owner.md'), doc);
  execFileSync('git', ['add', '.'], { cwd: root });
  return root;
};

test('a glob that matches a file passes', () => {
  const root = makeFixture({ doc: '| live | `apps/desktop/src/features/live/**` |\n' });
  const result = runOn({ root });
  assert.doesNotMatch(result.stderr, /Docs name what does not exist/);
});

test('a glob that matches nothing fails and names doc and line', () => {
  const root = makeFixture({ doc: 'text\n| dead | `apps/desktop/src/components/Gone/**` |\n' });
  const result = runOn({ root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /docs\/owner\.md:2 glob apps\/desktop\/src\/components\/Gone\/\*\*/);
});

test('every glob in the real docs matches a file', () => {
  const result = runOn({ root: REPO });
  assert.equal(result.status, 0, result.stderr);
});

test('each recipe is at most 40 lines', () => {
  const dir = resolve(REPO, 'docs/recipes');
  const files = readdirSync(dir).filter((name) => name.endsWith('.md'));
  assert.ok(files.length >= 11);
  for (const name of files) {
    const lines = readFileSync(join(dir, name), 'utf8').trimEnd().split('\n').length;
    assert.ok(lines <= MAX_RECIPE_LINES, `${name} has ${lines} lines`);
  }
});
