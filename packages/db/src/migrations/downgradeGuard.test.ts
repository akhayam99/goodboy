import { describe, expect, it, vi } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import {
  DatabaseFromNewerBuildError,
  NEWER_BUILD_MESSAGE,
  pickRestorableSnapshot,
} from './downgradeGuard';
import type { Migration } from './index';
import { migrate } from './runner';
import { runRuntimeMigrations, type MigrationSnapshotStorage } from './runRuntimeMigrations';

const first = {
  version: 1,
  sql: 'CREATE TABLE guard_one (id INTEGER PRIMARY KEY);',
} satisfies Migration;
const second = {
  version: 2,
  sql: 'CREATE TABLE guard_two (id INTEGER PRIMARY KEY);',
} satisfies Migration;
const third = {
  version: 3,
  sql: 'CREATE TABLE guard_three (id INTEGER PRIMARY KEY);',
} satisfies Migration;

describe('downgrade guard', () => {
  it('refuses a database migrated past the highest version this build knows', async () => {
    const db = makeTestDatabase();
    await migrate(db, [first, second, third]);

    const failure = await migrate(db, [first]).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DatabaseFromNewerBuildError);
    expect(failure).toMatchObject({
      message: NEWER_BUILD_MESSAGE,
      unknownVersions: [2, 3],
      highestKnownVersion: 1,
    });
  });

  it('opens a database that only lacks migrations this build will apply', async () => {
    const db = makeTestDatabase();
    await migrate(db, [first]);

    const result = await migrate(db, [first, second]);

    expect(result.applied).toEqual([2]);
  });

  it('refuses before taking a snapshot or applying anything at startup', async () => {
    const database = makeTestDatabase();
    await migrate(database, [first, third]);
    const statements: string[] = [];
    const storage = {
      list: vi.fn(async () => []),
      remove: vi.fn(async () => undefined),
    } satisfies MigrationSnapshotStorage;

    await expect(
      runRuntimeMigrations({
        databasePath: '/tmp/data.db',
        db: {
          ...database,
          exec: async (sql) => {
            statements.push(sql);
            await database.exec(sql);
          },
        },
        migrations: [first, second],
        storage,
      }),
    ).rejects.toBeInstanceOf(DatabaseFromNewerBuildError);
    expect(statements.some((statement) => statement.startsWith('VACUUM INTO'))).toBe(false);
    const tables = await database.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'guard_two'",
    );
    expect(tables).toEqual([]);
  });
});

describe('pickRestorableSnapshot', () => {
  it('picks the newest snapshot whose schema this build can read', () => {
    const picked = pickRestorableSnapshot({
      paths: [
        '/tmp/data.db.pre-m170-from-m168-20260801T120000000Z.bak',
        '/tmp/data.db.pre-m174-from-m173-20260901T120000000Z.bak',
        '/tmp/data.db.pre-m176-from-m175-20260910T120000000Z.bak',
      ],
      highestKnownVersion: 173,
    });

    expect(picked).toBe('/tmp/data.db.pre-m174-from-m173-20260901T120000000Z.bak');
  });

  it('reads the version of a legacy snapshot name from its only number', () => {
    const picked = pickRestorableSnapshot({
      paths: ['/tmp/data.db.pre-m120-20260820T120000000Z.bak', '/tmp/data.db.pre-m9-bad.bak'],
      highestKnownVersion: 150,
    });

    expect(picked).toBe('/tmp/data.db.pre-m120-20260820T120000000Z.bak');
  });

  it('returns null when every snapshot is newer than this build', () => {
    const picked = pickRestorableSnapshot({
      paths: ['/tmp/data.db.pre-m176-from-m175-20260910T120000000Z.bak'],
      highestKnownVersion: 173,
    });

    expect(picked).toBeNull();
  });
});
