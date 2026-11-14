import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { foreignKeyViolations, migrateThrough } from '../test-helpers/migration-rows';
import { AUTO_SEED_NOW, seedAutoSession, seedAutoTree } from '../test-helpers/auto-seeds';
import { DatabaseFromNewerBuildError } from './downgradeGuard';
import { migrations } from './index';
import { migrate } from './runner';

type DatabaseParams = { readonly db: Database };

type GrantParams = DatabaseParams & {
  readonly id: string;
  readonly kind: string;
  readonly attemptId: string | null;
  readonly textVersion: string | null;
  readonly state?: string;
  readonly answeredAt?: number | null;
};

const seedAttempt = async ({ db }: DatabaseParams): Promise<void> => {
  await db.execute(
    `INSERT INTO auto_delegations
      (id, tree_id, generation, request_id, request_hash, batch_id, slot, child_agent_id,
       first_attempt_id, role, request_json, target_json, routing_json, deadline_at, created_at)
     VALUES ('delegation-1', 'tree-1', 1, 'request-1', 'hash', 'batch-1', 0, 'agent-tester',
       'attempt-1', 'tester', '{}', '{}', '{}', ?, ?)`,
    [AUTO_SEED_NOW, AUTO_SEED_NOW],
  );
  await db.execute(
    `INSERT INTO auto_attempts (id, delegation_id, tree_id, generation, ordinal, started_at)
     VALUES ('attempt-1', 'delegation-1', 'tree-1', 1, 1, ?)`,
    [AUTO_SEED_NOW],
  );
};

const insertGrant = async ({
  db,
  id,
  kind,
  attemptId,
  textVersion,
  state = 'asked',
  answeredAt = null,
}: GrantParams): Promise<void> => {
  await db.execute(
    `INSERT INTO auto_grants
      (id, tree_id, delegation_id, attempt_id, text_version, kind, subject, state, answered_at,
       created_at, updated_at)
     VALUES (?, 'tree-1', ?, ?, ?, ?, 'nock@14.0.1', ?, ?, ?, ?)`,
    [
      id,
      attemptId === null ? null : 'delegation-1',
      attemptId,
      textVersion,
      kind,
      state,
      answeredAt,
      AUTO_SEED_NOW,
      AUTO_SEED_NOW,
    ],
  );
};

describe('m243 lead permissions', () => {
  it('adds the columns empty on a tree and an attempt that already exist', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 242 });
    await seedAutoSession({ db });
    await seedAutoTree({ db });
    await seedAttempt({ db });

    const result = await migrateThrough({ db, version: 243 });

    expect(result.applied).toEqual([243]);
    expect(await db.select('SELECT permissions FROM auto_trees')).toEqual([{ permissions: '{}' }]);
    expect(await db.select('SELECT launch_snapshot FROM auto_attempts')).toEqual([
      { launch_snapshot: null },
    ]);
    expect(await db.select('SELECT id FROM auto_grants')).toEqual([]);
    expect(await foreignKeyViolations(db)).toEqual([]);
  });

  it('refuses permissions and a launch snapshot that are not JSON', async () => {
    const db = await makeMigratedTestDatabase();
    await seedAutoSession({ db });
    await seedAutoTree({ db });
    await seedAttempt({ db });

    await expect(
      db.execute("UPDATE auto_trees SET permissions = 'push' WHERE id = 'tree-1'"),
    ).rejects.toThrow();
    await expect(
      db.execute("UPDATE auto_attempts SET launch_snapshot = 'notes' WHERE id = 'attempt-1'"),
    ).rejects.toThrow();
    await db.execute(`UPDATE auto_trees SET permissions = '{"push":"ask"}' WHERE id = 'tree-1'`);
    expect(await db.select('SELECT permissions FROM auto_trees')).toEqual([
      { permissions: '{"push":"ask"}' },
    ]);
  });

  it('binds a dependency ask to an attempt and a pull request ask to a text version', async () => {
    const db = await makeMigratedTestDatabase();
    await seedAutoSession({ db });
    await seedAutoTree({ db });
    await seedAttempt({ db });

    await insertGrant({
      db,
      id: 'g1',
      kind: 'dependency',
      attemptId: 'attempt-1',
      textVersion: null,
    });
    await insertGrant({ db, id: 'g2', kind: 'pull_request', attemptId: null, textVersion: 'v1' });
    await expect(
      insertGrant({
        db,
        id: 'g3',
        kind: 'pull_request',
        attemptId: 'attempt-1',
        textVersion: null,
      }),
    ).rejects.toThrow();
    await expect(
      insertGrant({ db, id: 'g4', kind: 'protected_file', attemptId: null, textVersion: 'v1' }),
    ).rejects.toThrow();
    await expect(
      insertGrant({ db, id: 'g5', kind: 'dependency', attemptId: 'attempt-1', textVersion: 'v1' }),
    ).rejects.toThrow();
    await expect(
      insertGrant({ db, id: 'g6', kind: 'dependency', attemptId: 'attempt-1', textVersion: null }),
    ).rejects.toThrow();
  });

  it('keeps the state list closed and an answer time only on an answered ask', async () => {
    const db = await makeMigratedTestDatabase();
    await seedAutoSession({ db });
    await seedAutoTree({ db });
    await seedAttempt({ db });

    await expect(
      insertGrant({
        db,
        id: 'g1',
        kind: 'dependency',
        attemptId: 'attempt-1',
        textVersion: null,
        state: 'pending',
      }),
    ).rejects.toThrow();
    await expect(
      insertGrant({
        db,
        id: 'g2',
        kind: 'dependency',
        attemptId: 'attempt-1',
        textVersion: null,
        state: 'allowed',
      }),
    ).rejects.toThrow();
    await insertGrant({
      db,
      id: 'g3',
      kind: 'dependency',
      attemptId: 'attempt-1',
      textVersion: null,
      state: 'allowed',
      answeredAt: AUTO_SEED_NOW,
    });
    await expect(
      insertGrant({ db, id: 'g4', kind: 'unknown', attemptId: 'attempt-1', textVersion: null }),
    ).rejects.toThrow();
  });

  it('drops the asks with their tree', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute('PRAGMA foreign_keys = ON');
    await seedAutoSession({ db });
    await seedAutoTree({ db });
    await seedAttempt({ db });
    await insertGrant({
      db,
      id: 'g1',
      kind: 'dependency',
      attemptId: 'attempt-1',
      textVersion: null,
    });
    await insertGrant({ db, id: 'g2', kind: 'pull_request', attemptId: null, textVersion: 'v1' });

    await db.execute("DELETE FROM auto_trees WHERE id = 'tree-1'");

    expect(await db.select('SELECT id FROM auto_grants')).toEqual([]);
  });

  it('is refused by an older build, which offers the backup instead', async () => {
    const db = await makeMigratedTestDatabase();
    const olderBuild = migrations.filter((migration) => migration.version < 243);
    const failure = await migrate(db, olderBuild).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DatabaseFromNewerBuildError);
  });
});
