import { describe, expect, it } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertDiffComment, listDiffCommentsForSession } from '../queries/diff-comment';
import { listResolveQueueItems } from '../queries/resolve-queue-item';
import { listResolveThreads } from '../queries/resolve-thread';
import { migrations } from './index';
import { migrate } from './runner';

const SESSION = 'session' as SessionId;

const seedBefore = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 196 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Checkout', 'idle', 1, 1)",
  );
  await db.execute(
    `INSERT INTO resolve_threads (id, session_id, pr_number, thread_id, origin_kind, state, created_at, updated_at)
     VALUES ('pr-row', 'session', 528, 'PRRT_1', 'review_comment', 'open', 2, 2),
            ('sentinel-row', 'session', 0, 'agent-thread', 'diff_comment', 'open', 3, 3)`,
  );
  await db.execute(
    `INSERT INTO resolve_attempts (id, session_id, agent_id, pr_number, thread_ids_json, provider, model, phase, created_at)
     VALUES ('attempt', 'session', 'agent', 0, '[]', 'claude', 'opus', 'finished', 4)`,
  );
  await db.execute(
    `INSERT INTO diff_comments (id, session_id, file_path, body, status, created_at, line_number, line_side)
     VALUES ('open-note', 'session', 'src/ledger.ts', 'Round half even here', 'open', 5, 42, 'new'),
            ('done-note', 'session', 'src/ledger.ts', 'Already handled', 'resolved', 6, 7, 'new')`,
  );
  return db;
};

describe('m197 resolve threads without a pull request', () => {
  it('keeps pull request numbers and turns the zero sentinel into no pull request', async () => {
    const db = await seedBefore();

    await migrate(db, migrations);

    const rows = await listResolveThreads({ db, sessionId: SESSION });
    expect(rows.find((row) => row.id === 'pr-row')?.prNumber).toBe(528);
    expect(rows.find((row) => row.id === 'sentinel-row')?.prNumber).toBeNull();
    expect(
      await db.select('SELECT pr_number FROM resolve_attempts WHERE id = ?', ['attempt']),
    ).toEqual([{ pr_number: null }]);
  });

  it('opens a conversation for every open note and none for settled ones', async () => {
    const db = await seedBefore();

    await migrate(db, migrations);

    const notes = (await listResolveThreads({ db, sessionId: SESSION })).filter(
      (row) => row.diffCommentId !== null,
    );
    expect(notes).toEqual([
      expect.objectContaining({
        threadId: 'note:open-note',
        diffCommentId: 'open-note',
        originKind: 'diff_comment',
        prNumber: null,
        state: 'open',
        stage: 'new',
      }),
    ]);
    const queued = await listResolveQueueItems({ db, sessionId: SESSION });
    expect(queued.map((entry) => entry.item.threadId)).toContain('note:open-note');
    expect(queued.map((entry) => entry.item.threadId)).not.toContain('note:done-note');
  });

  it('marks existing notes as written by you and records an agent author', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);

    await insertDiffComment(db, 'agent-note', SESSION, 'src/fx.ts', 'Cache the rate', undefined, {
      kind: 'agent',
      agentId: 'reviewer' as AgentId,
    });

    const notes = await listDiffCommentsForSession(db, SESSION);
    expect(notes.find((note) => note.id === 'open-note')?.authorKind).toBe('user');
    expect(notes.find((note) => note.id === 'agent-note')).toEqual(
      expect.objectContaining({ authorKind: 'agent', authorAgentId: 'reviewer' }),
    );
  });
});
