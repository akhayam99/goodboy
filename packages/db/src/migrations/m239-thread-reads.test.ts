import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertRow, migrateThrough } from '../test-helpers/migration-rows';
import { listThreadReads, markThreadsRead } from '../queries/thread-read';

describe('m239 thread reads', () => {
  it('adds an empty table keyed by session and thread', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 238 });

    const result = await migrateThrough({ db, version: 239 });

    expect(result.applied).toEqual([239]);
    expect(await db.select('SELECT thread_id FROM thread_reads')).toEqual([]);
    const columns = await db.select<{ name: string }>('PRAGMA table_info(thread_reads)');
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'session_id',
      'thread_id',
      'read_at',
      'created_at',
      'updated_at',
    ]);
  });

  it('keeps the latest read time and drops the rows with the session', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute('PRAGMA foreign_keys = ON');
    await insertRow({
      db,
      table: 'workspaces',
      row: { id: 'w1', slug: '/tmp/harborline', name: 'Harborline', created_at: 1, updated_at: 1 },
    });
    await insertRow({
      db,
      table: 'sessions',
      row: {
        id: 's1',
        workspace_id: 'w1',
        goal: 'Northwind',
        state_kind: 'idle',
        created_at: 1,
        updated_at: 1,
      },
    });
    const sessionId = brandId<SessionId>({ value: 's1' });

    await markThreadsRead({ db, sessionId, threadIds: ['t1', 't2'], readAt: 20 });
    await markThreadsRead({ db, sessionId, threadIds: ['t1'], readAt: 10 });

    expect(await listThreadReads({ db, sessionId })).toEqual([
      { threadId: 't1', readAt: 20 },
      { threadId: 't2', readAt: 20 },
    ]);
    await db.execute('DELETE FROM sessions WHERE id = ?', ['s1']);
    expect(await listThreadReads({ db, sessionId })).toEqual([]);
  });
});
