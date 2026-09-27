import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { SEARCH_WORLD, seedSearchWorld } from '../test-helpers/search-fixtures';
import {
  purgeExcludedSearchDocs,
  readSearchBackfillProgress,
  rebuildSearchIndex,
  runSearchBackfillStep,
} from './searchBackfill';

type IndexedRow = Readonly<Record<string, unknown>>;

type SnapshotParams = {
  readonly db: Database;
};

const snapshot = async ({ db }: SnapshotParams): Promise<ReadonlyArray<IndexedRow>> =>
  db.select<IndexedRow>(
    `SELECT d.id, d.kind, d.ref_id, d.workspace_id, d.session_id, d.agent_id, d.mount_id,
       d.project_id, d.provider, d.container, d.status, d.occurred_at, f.title, f.body
     FROM search_docs d JOIN search_index f ON f.rowid = d.fts_rowid
     ORDER BY d.id`,
  );

type BackfillAllParams = {
  readonly db: Database;
  readonly batchSize?: number;
};

const backfillAll = async ({ db, batchSize }: BackfillAllParams): Promise<number> => {
  let steps = 0;
  for (;;) {
    steps += 1;
    const step = await runSearchBackfillStep({ db, now: SEARCH_WORLD.now, batchSize });
    if (step.isDone || steps > 500) {
      return steps;
    }
  }
};

const seeded = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await seedSearchWorld({ db });
  return db;
};

const count = async ({ db }: SnapshotParams): Promise<number> => {
  const [row] = await db.select<{ count: number }>('SELECT COUNT(*) AS count FROM search_index');
  return row?.count ?? 0;
};

describe('search backfill', () => {
  it('writes exactly the docs the triggers write, for every type', async () => {
    const db = await seeded();
    const fromTriggers = await snapshot({ db });
    await rebuildSearchIndex({ db });
    expect(await count({ db })).toBe(0);

    await backfillAll({ db });

    expect(await snapshot({ db })).toEqual(fromTriggers);
  });

  it('resumes from its cursor across batches and restarts', async () => {
    const db = await seeded();
    const fromTriggers = await snapshot({ db });
    await rebuildSearchIndex({ db });

    await runSearchBackfillStep({ db, now: SEARCH_WORLD.now, batchSize: 1 });
    const [state] = await db.select<{ id: string; cursor: string; isDone: number }>(
      'SELECT id, cursor, is_done AS isDone FROM search_index_state',
    );
    expect(state).toEqual({ id: 'session', cursor: SEARCH_WORLD.sessionId, isDone: 0 });

    const steps = await backfillAll({ db, batchSize: 1 });
    expect(steps).toBeGreaterThan(11);
    expect(await snapshot({ db })).toEqual(fromTriggers);
  });

  it('skips rows the triggers already indexed and never duplicates', async () => {
    const db = await seeded();
    await db.exec(`DELETE FROM search_docs WHERE kind = 'message'`);
    const before = await count({ db });
    await backfillAll({ db, batchSize: 2 });
    expect(await count({ db })).toBe(before + 3);
    await db.exec('DELETE FROM search_index_state');
    await backfillAll({ db });
    expect(await count({ db })).toBe(before + 3);
    const [orphans] = await db.select<{ count: number }>(
      'SELECT COUNT(*) AS count FROM search_docs WHERE fts_rowid NOT IN (SELECT rowid FROM search_index)',
    );
    expect(orphans?.count).toBe(0);
  });

  it('indexes rows written while it runs through the triggers', async () => {
    const db = await seeded();
    await rebuildSearchIndex({ db });
    await runSearchBackfillStep({ db, now: SEARCH_WORLD.now, batchSize: 1 });
    await db.execute(
      `INSERT INTO messages (id, session_id, agent_id, role, content, created_at)
       VALUES ('msg-late', '${SEARCH_WORLD.sessionId}', '${SEARCH_WORLD.agentId}', 'user', 'late reconciliation note', 1)`,
    );
    await backfillAll({ db, batchSize: 1 });
    const rows = await db.select<{ id: string }>(
      "SELECT d.id FROM search_index JOIN search_docs d ON d.fts_rowid = search_index.rowid WHERE search_index MATCH 'reconciliation'",
    );
    expect(rows).toEqual([{ id: 'message:msg-late' }]);
  });

  it('reports its progress', async () => {
    const db = await seeded();
    await rebuildSearchIndex({ db });
    const start = await readSearchBackfillProgress({ db });
    expect(start).toMatchObject({ scanned: 0, isDone: false });
    expect(start.total).toBeGreaterThan(15);
    await runSearchBackfillStep({ db, now: SEARCH_WORLD.now });
    await runSearchBackfillStep({ db, now: SEARCH_WORLD.now });
    const middle = await readSearchBackfillProgress({ db });
    expect(middle.scanned).toBe(6);
    await backfillAll({ db });
    const end = await readSearchBackfillProgress({ db });
    expect(end).toEqual({ scanned: end.total, total: start.total, isDone: true });
  });

  it('purges the docs of an excluded project', async () => {
    const db = await seeded();
    await db.execute(
      `INSERT INTO search_excluded_projects (id, project_id, created_at, updated_at) VALUES ('x', '${SEARCH_WORLD.projectId}', 1, 1)`,
    );
    const purged = await purgeExcludedSearchDocs({ db });
    expect(purged).toBeGreaterThan(0);
    const rows = await db.select<{ id: string }>('SELECT id FROM search_docs ORDER BY id');
    expect(rows.map((row) => row.id)).toEqual([
      'agent:a-relay',
      'message:msg-relay',
      'session:s-relay',
      'starred:ws-harborline:jira:jira-88',
    ]);
  });

  it('purges nothing when no project is excluded', async () => {
    const db = await seeded();
    expect(await purgeExcludedSearchDocs({ db })).toBe(0);
  });
});
