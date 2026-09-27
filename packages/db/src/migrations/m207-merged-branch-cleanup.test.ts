import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProjectId, WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  getDeletedBranch,
  insertDeletedBranch,
  listDeletedBranches,
  listExpiredDeletedBranches,
  markDeletedBranchRestored,
} from '../queries/deleted-branch';
import { migrations } from './index';
import { migrate } from './runner';

type AfterMergeRow = {
  readonly id: string;
  readonly after_merge: string | null;
};

const seedWorkspace = async (db: Awaited<ReturnType<typeof makeMigratedTestDatabase>>) => {
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('harborline', 'Harborline', 'harborline', 1, 1)`,
  );
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
     VALUES ('ledger', 'harborline', 'ledger-core', '/repos/ledger-core', 'repo', 1, 1)`,
  );
};

describe('m207 merged branch cleanup', () => {
  it('keeps existing workspaces on Ask me and leaves new ones to the default', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 197 });
    await db.execute(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
       VALUES ('harborline', 'Harborline', 'harborline', 1, 1)`,
    );

    await migrate(db, migrations);
    await db.execute(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
       VALUES ('northwind', 'Northwind', 'northwind', 2, 2)`,
    );

    expect(
      await db.select<AfterMergeRow>('SELECT id, after_merge FROM workspaces ORDER BY id'),
    ).toEqual([
      { id: 'harborline', after_merge: 'ask' },
      { id: 'northwind', after_merge: null },
    ]);
  });

  it('refuses an after-merge rule nobody knows', async () => {
    const db = await makeMigratedTestDatabase();
    await seedWorkspace(db);

    await expect(
      db.execute("UPDATE projects SET after_merge = 'everything' WHERE id = 'ledger'"),
    ).rejects.toThrow();
  });

  it('records a deleted branch, lists it, and marks it restored once', async () => {
    const db = await makeMigratedTestDatabase();
    await seedWorkspace(db);
    const entry = {
      id: 'deleted-1',
      workspaceId: 'harborline' as WorkspaceId,
      projectId: 'ledger' as ProjectId,
      sessionId: null,
      repoRoot: '/repos/ledger-core',
      branch: 'goodboy/fx-rates',
      sha: 'abc123',
      keepRef: 'refs/goodboy/deleted/goodboy/fx-rates',
      onOrigin: true,
      deletedAt: '2026-09-01T10:00:00.000Z' as IsoDateTime,
      restoredAt: null,
    };

    await insertDeletedBranch({ db, entry });

    expect(await listDeletedBranches({ db, workspaceId: entry.workspaceId })).toEqual([entry]);
    expect(
      await listExpiredDeletedBranches({ db, before: '2026-09-20T10:00:00.000Z' as IsoDateTime }),
    ).toEqual([entry]);

    await markDeletedBranchRestored({
      db,
      id: entry.id,
      restoredAt: '2026-09-02T10:00:00.000Z' as IsoDateTime,
    });
    await markDeletedBranchRestored({
      db,
      id: entry.id,
      restoredAt: '2026-09-03T10:00:00.000Z' as IsoDateTime,
    });

    expect((await getDeletedBranch({ db, id: entry.id }))?.restoredAt).toBe(
      '2026-09-02T10:00:00.000Z',
    );
    expect(
      await listExpiredDeletedBranches({ db, before: '2026-09-20T10:00:00.000Z' as IsoDateTime }),
    ).toEqual([]);
  });

  it('starts every existing mount as unknown origin', async () => {
    const db = await makeMigratedTestDatabase();

    const columns = await db.select<{ readonly name: string; readonly dflt_value: string | null }>(
      "SELECT name, dflt_value FROM pragma_table_info('session_worktrees') WHERE name = 'branch_origin'",
    );

    expect(columns).toEqual([{ name: 'branch_origin', dflt_value: "'unknown'" }]);
  });

  it('keeps a history event from before the rebuild and accepts its own new kinds', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 200 });
    await db.execute(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
       VALUES ('harborline', 'Harborline', 'harborline', 1, 1)`,
    );
    await db.execute(
      `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
       VALUES ('session-1', 'harborline', 'Ledger', 'idle', 1, 1)`,
    );
    await db.execute(
      'INSERT INTO session_events (id, session_id, kind, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
      ['ev-history', 'session-1', 'history_stopped', '{"planId":"plan-1"}', 1],
    );

    await migrate(db, migrations);
    await db.execute(
      'INSERT INTO session_events (id, session_id, kind, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
      ['ev-branch-deleted', 'session-1', 'branch_deleted', '{"branch":"goodboy/fx-rates"}', 2],
    );
    await db.execute(
      'INSERT INTO session_events (id, session_id, kind, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
      ['ev-branch-restored', 'session-1', 'branch_restored', '{"branch":"goodboy/fx-rates"}', 3],
    );

    const rows = await db.select<{ id: string; kind: string }>(
      'SELECT id, kind FROM session_events ORDER BY created_at ASC',
    );
    expect(rows).toEqual([
      { id: 'ev-history', kind: 'history_stopped' },
      { id: 'ev-branch-deleted', kind: 'branch_deleted' },
      { id: 'ev-branch-restored', kind: 'branch_restored' },
    ]);
  });
});
