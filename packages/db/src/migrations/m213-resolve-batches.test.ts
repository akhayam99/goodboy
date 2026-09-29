import { describe, expect, it } from 'vitest';
import type { AgentId, ResolveAttempt, ResolveLaunchChoice, SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  getResolveParallelLimit,
  insertResolveBatch,
  listResolveBatches,
  setResolveParallelLimit,
} from '../queries/resolve-batch';
import {
  insertResolveAttempt,
  listResolveAttempts,
  setResolveAttemptCopyPath,
} from '../queries/resolve-attempt';
import {
  listResolveThreadFacts,
  setResolveThreadGitState,
  setResolveThreadVerdict,
} from '../queries/resolve-thread-facts';
import { listResolveThreads } from '../queries/resolve-thread';
import { migrate } from './runner';

const SESSION = 'session' as SessionId;

const CHOICE = {
  provider: 'anthropic',
  model: 'sonnet',
  effort: 'medium',
  commitStyle: 'fixup',
  hint: 'Keep the ledger rounding half even',
} satisfies ResolveLaunchChoice;

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 212 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Checkout', 'idle', 1, 1)",
  );
  await db.execute(
    `INSERT INTO resolve_threads (id, session_id, thread_id, origin_kind, state, revision, created_at, updated_at)
     VALUES ('review-row', 'session', 'PRRT_1', 'review_comment', 'open', 3, 1, 1)`,
  );
  await db.execute(
    `INSERT INTO resolve_threads (id, session_id, thread_id, origin_kind, state, created_at, updated_at)
     VALUES ('note-row', 'session', 'note:rounding', 'diff_comment', 'open', 2, 2)`,
  );
  const result = await migrate(db);
  expect(result.applied).toEqual([213]);
  return db;
};

const attempt = (batchId: string | null): ResolveAttempt => ({
  id: 'attempt',
  sessionId: SESSION,
  agentId: 'agent' as AgentId,
  prNumber: 318,
  threadIds: ['PRRT_1'],
  provider: 'anthropic',
  model: 'sonnet',
  effort: null,
  instructions: 'fix it',
  phase: 'queued',
  mountTarget: null,
  startedAt: null,
  endedAt: null,
  error: null,
  createdAt: 5,
  batchId,
  copyPath: null,
  launchChoice: batchId === null ? null : CHOICE,
});

describe('m213 resolve batches', () => {
  it('backfills the source of existing threads and leaves their revision alone', async () => {
    const db = await seed();
    const facts = await listResolveThreadFacts({ db, sessionId: SESSION });
    expect(facts.map((fact) => [fact.threadId, fact.sourceKind])).toEqual([
      ['PRRT_1', 'github'],
      ['note:rounding', 'local'],
    ]);
    expect(facts[0]).toEqual(
      expect.objectContaining({ gitState: null, verdict: null, sourceSnapshot: null }),
    );
    const rows = await listResolveThreads({ db, sessionId: SESSION });
    expect(rows.find((row) => row.threadId === 'PRRT_1')?.revision).toBe(3);
  });

  it('stores a batch with its launch choice and links attempts to it', async () => {
    const db = await seed();
    await insertResolveBatch({
      db,
      batch: {
        id: 'batch',
        sessionId: SESSION,
        threadIds: ['PRRT_1'],
        launchChoice: CHOICE,
        createdAt: 4,
      },
    });
    await insertResolveAttempt({ db, attempt: attempt('batch') });
    await insertResolveAttempt({ db, attempt: { ...attempt(null), phase: 'running' } });
    await setResolveAttemptCopyPath({ db, id: 'attempt', copyPath: '/tmp/copy' });

    const [batch] = await listResolveBatches({ db, sessionId: SESSION });
    const [stored] = await listResolveAttempts({ db, sessionId: SESSION });
    expect(batch?.launchChoice).toEqual(CHOICE);
    expect(stored).toEqual(
      expect.objectContaining({
        batchId: 'batch',
        launchChoice: CHOICE,
        copyPath: '/tmp/copy',
        phase: 'running',
      }),
    );
  });

  it('keeps the per session parallel limit at 4 until it is changed, clamped to 1..16', async () => {
    const db = await seed();
    expect(await getResolveParallelLimit({ db, sessionId: SESSION })).toBe(4);
    expect(await setResolveParallelLimit({ db, sessionId: SESSION, limit: 40 })).toBe(16);
    await setResolveParallelLimit({ db, sessionId: SESSION, limit: 2 });
    expect(await getResolveParallelLimit({ db, sessionId: SESSION })).toBe(2);
  });

  it('writes git state and verdict without bumping the thread revision', async () => {
    const db = await seed();
    await setResolveThreadGitState({
      db,
      sessionId: SESSION,
      threadId: 'PRRT_1',
      gitState: 'folded',
    });
    await setResolveThreadVerdict({
      db,
      sessionId: SESSION,
      threadId: 'PRRT_1',
      verdict: {
        kind: 'fixed_elsewhere',
        evidence: 'folded into e31b9f4',
        sha: 'e31b9f4',
        checkedAt: 9,
      },
    });
    const [fact] = await listResolveThreadFacts({ db, sessionId: SESSION });
    expect(fact?.gitState).toBe('folded');
    expect(fact?.verdict?.kind).toBe('fixed_elsewhere');
    await expect(
      db.execute("UPDATE resolve_threads SET git_state = 'pushed' WHERE thread_id = 'PRRT_1'"),
    ).rejects.toThrow();
    const rows = await listResolveThreads({ db, sessionId: SESSION });
    expect(rows.find((row) => row.threadId === 'PRRT_1')?.revision).toBe(3);
  });
});
