import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import { ALREADY_EXISTS_TOLERATED_THROUGH_VERSION, migrate } from './runner';
import type { Migration } from './index';

describe('enforced integrity check', { timeout: 30_000 }, () => {
  const INTEGRITY_MIGRATION = {
    version: 1157,
    sql: `
      CREATE TABLE integrity_probe (id INTEGER PRIMARY KEY);
      PRAGMA integrity_check;
    `,
  } satisfies Migration;

  const makeDatabaseFile = (): string =>
    join(mkdtempSync(join(tmpdir(), 'goodboy-integrity-')), 'data.db');

  const seedIndexedRows = ({ raw }: { readonly raw: BetterSqlite3.Database }): void => {
    raw.exec('CREATE TABLE probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    raw.exec('CREATE INDEX probe_value ON probe(value)');
    const insert = raw.prepare('INSERT INTO probe (id, value) VALUES (?, ?)');
    for (let id = 1; id <= 200; id += 1) {
      insert.run(id, `value-${id}`);
    }
  };

  it('aborts the migration when the database is corrupt', async () => {
    const path = makeDatabaseFile();
    const raw = new BetterSqlite3(path);
    seedIndexedRows({ raw });
    raw.unsafeMode(true);
    raw.pragma('writable_schema = ON');
    raw.prepare("DELETE FROM sqlite_master WHERE name = 'probe_value'").run();
    raw.pragma('writable_schema = OFF');
    raw.close();

    const db = makeTestDatabase(path);
    await expect(migrate(db, [INTEGRITY_MIGRATION])).rejects.toThrow(
      /Migration v1157: integrity check failed: .*never used/s,
    );
    const versions = await db.select<{ readonly version: number }>(
      'SELECT version FROM schema_version WHERE version = 1157',
    );
    expect(versions).toEqual([]);
    rmSync(dirname(path), { force: true, recursive: true });
  });

  it('applies the migration when the database is sound', async () => {
    const path = makeDatabaseFile();
    const raw = new BetterSqlite3(path);
    seedIndexedRows({ raw });
    raw.close();

    const db = makeTestDatabase(path);
    const result = await migrate(db, [INTEGRITY_MIGRATION]);
    const tables = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'integrity_probe'",
    );
    expect(result.applied).toEqual([1157]);
    expect(tables).toEqual([{ name: 'integrity_probe' }]);
    rmSync(dirname(path), { force: true, recursive: true });
  });
});

describe('already exists', () => {
  const sql = 'CREATE TABLE harborline_ledger (id INTEGER PRIMARY KEY);';

  it('is tolerated and logged for a version up to the checkpoint', async () => {
    const db = makeTestDatabase();
    await db.exec('CREATE TABLE harborline_ledger (id INTEGER PRIMARY KEY)');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await migrate(db, [{ version: ALREADY_EXISTS_TOLERATED_THROUGH_VERSION, sql }]);

    expect(result.applied).toEqual([ALREADY_EXISTS_TOLERATED_THROUGH_VERSION]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('fails a version above the checkpoint and leaves it unrecorded', async () => {
    const db = makeTestDatabase();
    await db.exec('CREATE TABLE harborline_ledger (id INTEGER PRIMARY KEY)');
    const version = ALREADY_EXISTS_TOLERATED_THROUGH_VERSION + 1;

    await expect(migrate(db, [{ version, sql }])).rejects.toThrow('already exists');

    const recorded = await db.select<{ version: number }>(
      'SELECT version FROM schema_version WHERE version = ?',
      [version],
    );
    expect(recorded).toEqual([]);
  });
});
