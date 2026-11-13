import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'make-perf-fixture.mjs');
const Database = createRequire(join(ROOT, 'packages', 'db', 'package.json'))('better-sqlite3');
const MOCK_WORKSPACES = ['Harborline', 'Northwind', 'Acme', 'Cascadia'];
const MOCK_PROJECTS = ['ledger-core', 'notify-relay', 'payments-api'];

const run = ({ args }) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd: ROOT });

describe('make-perf-fixture', () => {
  let workDir = '';
  let out = '';
  let db = null;

  const count = ({ table, where = '1 = 1' }) =>
    db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`).get().total;

  before(() => {
    workDir = mkdtempSync(join(tmpdir(), 'goodboy-fixture-test-'));
    out = join(workDir, 'fixture.db');
    const result = run({ args: ['--out', out] });
    assert.equal(result.status, 0, result.stderr);
    db = new Database(out, { readonly: true });
  });

  after(() => {
    db?.close();
    rmSync(workDir, { recursive: true, force: true });
  });

  it('writes four workspaces and seven active sessions', () => {
    assert.equal(count({ table: 'workspaces' }), 4);
    assert.equal(count({ table: 'sessions', where: 'archived_at IS NULL' }), 7);
  });

  it('writes 150 agents for each session', () => {
    const rows = db.prepare('SELECT COUNT(*) AS total FROM agents GROUP BY session_id').all();
    assert.equal(rows.length, 7);
    assert.ok(rows.every((row) => row.total === 150));
  });

  it('writes one agent with 5,000 events including large tool results', () => {
    const rows = db
      .prepare('SELECT agent_id, COUNT(*) AS total FROM turn_events GROUP BY agent_id')
      .all();
    assert.deepEqual(
      rows.map((row) => row.total),
      [5000],
    );
    const largest = db
      .prepare(
        "SELECT MAX(LENGTH(payload)) AS bytes FROM turn_events WHERE payload LIKE '%tool_call_end%'",
      )
      .get().bytes;
    assert.ok(largest > 10_000);
  });

  it('writes sixty worktree rows and merged pull request links', () => {
    assert.equal(count({ table: 'session_worktrees' }), 60);
    assert.ok(count({ table: 'mount_pr_links', where: "state = 'merged'" }) > 0);
  });

  it('opens the last workspace and session on launch', () => {
    const settings = Object.fromEntries(
      db
        .prepare('SELECT key, value FROM settings')
        .all()
        .map((row) => [row.key, row.value]),
    );
    assert.equal(settings['launch.reopen_last'], '1');
    assert.equal(settings['last.workspace_id'], 'workspace-harborline');
  });

  it('uses mock names only', () => {
    const workspaces = db
      .prepare('SELECT name FROM workspaces')
      .all()
      .map((row) => row.name);
    const projects = db
      .prepare('SELECT name FROM projects')
      .all()
      .map((row) => row.name);
    assert.deepEqual(workspaces.sort(), [...MOCK_WORKSPACES].sort());
    assert.ok(projects.every((name) => MOCK_PROJECTS.includes(name)));
    const paths = db.prepare('SELECT root_path AS path FROM projects').all();
    assert.ok(paths.every((row) => row.path.startsWith('/work/')));
  });

  it('refuses a path that already exists', () => {
    const result = run({ args: ['--out', out] });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /already exists/);
  });

  it('asks for an output path', () => {
    const result = run({ args: [] });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /usage/);
  });
});
