import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const ESLINT_BIN = join(REPO_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');
const CONFIG_URL = pathToFileURL(join(REPO_ROOT, 'eslint.config.mjs')).href;

const FIXTURE = [
  'const load = async (): Promise<number> => 1;',
  'load();',
  'export const isBad = /^(a+)+$/.test("aaaa");',
  '',
].join('\n');

const FIXTURE_WITH_ANOTHER_PROMISE = `${FIXTURE}load();\n`;

const TSCONFIG = JSON.stringify({
  compilerOptions: { strict: true, target: 'ES2022', module: 'ESNext', noEmit: true },
  include: ['src'],
});

const configFor = ({ dir }) =>
  [
    `import { lintTsConfig } from ${JSON.stringify(CONFIG_URL)};`,
    `export default lintTsConfig({ files: ['src/**/*.ts'], tsconfigRootDir: ${JSON.stringify(dir)} });`,
    '',
  ].join('\n');

const runLint = ({ dir, args = [] }) =>
  spawnSync(process.execPath, [ESLINT_BIN, '--config', 'eslint.config.mjs', ...args, 'src'], {
    cwd: dir,
    encoding: 'utf8',
  });

describe('lint:ts', () => {
  let dir = '';

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'goodboy-lint-ts-'));
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'tsconfig.json'), TSCONFIG);
    writeFileSync(join(dir, 'eslint.config.mjs'), configFor({ dir }));
    writeFileSync(join(dir, 'src', 'fixture.ts'), FIXTURE);
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('fails on a bare promise and a backtracking regex', () => {
    const result = runLint({ dir });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /no-floating-promises/);
    assert.match(result.stdout, /regexp\/no-super-linear-backtracking/);
  });

  it('passes the same lines once they sit in the suppressions file', () => {
    const suppress = runLint({ dir, args: ['--suppress-all'] });
    assert.equal(suppress.status, 0, suppress.stdout + suppress.stderr);
    const result = runLint({ dir });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });

  it('fails when a suppressed file gains one more violation', () => {
    writeFileSync(join(dir, 'src', 'fixture.ts'), FIXTURE_WITH_ANOTHER_PROMISE);
    const result = runLint({ dir });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /no-floating-promises/);
  });

  it('fails when a suppression no longer occurs, so the count only falls', () => {
    writeFileSync(join(dir, 'src', 'fixture.ts'), 'export const isOk = true;\n');
    const result = runLint({ dir });
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stderr, /suppressions left that do not occur/i);
  });
});
