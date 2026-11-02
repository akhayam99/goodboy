import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TAURI_DIRECTORY = resolve(ROOT_DIRECTORY, 'apps/desktop/src-tauri');

test('no skill command is registered or listed for a window', () => {
  const lib = readFileSync(resolve(TAURI_DIRECTORY, 'src/lib.rs'), 'utf8');
  const windows = readFileSync(resolve(TAURI_DIRECTORY, 'window-commands.json'), 'utf8');
  assert.equal(/skills::skill_/.test(lib), false);
  assert.equal(/"skill_/.test(windows), false);
});

test('the parity check passes with the skill commands unregistered', () => {
  const run = spawnSync('node', [resolve(ROOT_DIRECTORY, 'scripts/check-tauri-commands.mjs')], {
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /Tauri command parity OK/);
});
