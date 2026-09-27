import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { listResolveThreads } from '../queries/resolve-thread';
import { migrations } from './index';
import { migrate } from './runner';

const SESSION = 'session' as SessionId;

describe('m207 resolve thread generations', () => {
  it('defaults existing threads to generation 0 with no reopen link', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 206 });
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Checkout', 'idle', 1, 1)",
    );
    await db.execute(
      "INSERT INTO diff_comments (id, session_id, file_path, body, status, created_at) VALUES ('rounding', 'session', 'src/ledger.ts', 'Round half even', 'resolved', 1)",
    );
    await db.execute(
      `INSERT INTO resolve_threads (id, session_id, thread_id, origin_kind, diff_comment_id, state, created_at, updated_at)
       VALUES ('closed-row', 'session', 'note:rounding', 'diff_comment', 'rounding', 'closed', 1, 1)`,
    );

    await migrate(db, migrations);

    const [row] = await listResolveThreads({ db, sessionId: SESSION });
    expect(row).toEqual(
      expect.objectContaining({ id: 'closed-row', generation: 0, reopenedFromThreadId: null }),
    );

    await db.execute(
      `INSERT INTO resolve_threads (id, session_id, thread_id, origin_kind, diff_comment_id, state, generation, reopened_from_thread_id, created_at, updated_at)
       VALUES ('reopened-row', 'session', 'note:rounding:g1', 'diff_comment', 'rounding', 'open', 1, 'closed-row', 2, 2)`,
    );
    const rows = await listResolveThreads({ db, sessionId: SESSION });
    expect(rows.find((candidate) => candidate.id === 'reopened-row')).toEqual(
      expect.objectContaining({ generation: 1, reopenedFromThreadId: 'closed-row', state: 'open' }),
    );
    expect(rows.find((candidate) => candidate.id === 'closed-row')?.state).toBe('closed');
  });
});
