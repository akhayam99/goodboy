import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

type ThreadSeed = {
  readonly thread: string;
  readonly state: string;
  readonly revision?: number;
  readonly question?: string | null;
  readonly replyDraft?: string | null;
  readonly commitShas?: string | null;
  readonly attempt?: string | null;
};

type ItemSeed = {
  readonly thread: string;
  readonly approval: string;
  readonly approvedRevision?: number | null;
  readonly deliveredAt?: number | null;
  readonly integratedSha?: string | null;
};

type ReceiptSeed = {
  readonly thread: string;
  readonly revision: number;
  readonly replyPhase: string;
  readonly resolvePhase: string;
  readonly error?: string | null;
};

const seedBase = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 173 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute('DELETE FROM resolve_queue_items');
  await db.execute(`INSERT INTO resolve_attempts
    (id, session_id, agent_id, pr_number, thread_ids_json, provider, model, phase, created_at)
    VALUES ('running', 'session', 'agent', 1, '[]', 'anthropic', 'claude-sonnet-5', 'running', 1),
           ('failed', 'session', 'agent', 1, '[]', 'anthropic', 'claude-sonnet-5', 'failed', 1),
           ('cancelled', 'session', 'agent', 1, '[]', 'anthropic', 'claude-sonnet-5', 'cancelled', 1)`);
  await db.execute(`INSERT INTO resolve_publications
    (id, session_id, repo, pr_number, branch, local_head, commit_shas_json, requires_push, phase, created_at)
    VALUES ('publication', 'session', 'acme/ledger-core', 1, 'feature', 'abc', '[]', 0, 'failed', 1)`);
  return db;
};

type Db = Awaited<ReturnType<typeof seedBase>>;

const addThread = async (db: Db, seed: ThreadSeed): Promise<void> => {
  await db.execute(
    `INSERT INTO resolve_threads
      (id, session_id, pr_number, thread_id, origin_kind, state, revision, question, reply_draft, commit_shas_json, active_attempt_id, created_at, updated_at)
      VALUES (?, 'session', 1, ?, 'review_comment', ?, ?, ?, ?, ?, ?, 1, 1)`,
    [
      `row-${seed.thread}`,
      seed.thread,
      seed.state,
      seed.revision ?? 1,
      seed.question ?? null,
      seed.replyDraft ?? null,
      seed.commitShas ?? null,
      seed.attempt ?? null,
    ],
  );
};

const addItem = async (db: Db, seed: ItemSeed): Promise<void> => {
  await db.execute(
    `INSERT INTO resolve_queue_items
      (id, session_id, thread_id, generation, candidate_revision, approval_state, approved_revision, delivered_at, integrated_sha, created_at, updated_at)
      VALUES (?, 'session', ?, 0, 1, ?, ?, ?, ?, 1, 1)`,
    [
      `item-${seed.thread}`,
      seed.thread,
      seed.approval,
      seed.approvedRevision ?? null,
      seed.deliveredAt ?? null,
      seed.integratedSha ?? null,
    ],
  );
};

const addReceipt = async (db: Db, seed: ReceiptSeed): Promise<void> => {
  await db.execute(
    `INSERT INTO resolve_publication_threads
      (publication_id, thread_id, revision, prior_state, operation_id, reply_phase, resolve_phase, error)
      VALUES ('publication', ?, ?, 'fixed', ?, ?, ?, ?)`,
    [
      seed.thread,
      seed.revision,
      `op-${seed.thread}`,
      seed.replyPhase,
      seed.resolvePhase,
      seed.error ?? null,
    ],
  );
};

const stages = async (db: Db): Promise<Record<string, string>> => {
  const rows = await db.select<{ readonly thread_id: string; readonly stage: string }>(
    'SELECT thread_id, stage FROM resolve_threads ORDER BY thread_id',
  );
  return Object.fromEntries(rows.map((row) => [row.thread_id, row.stage]));
};

describe('m179 resolve stage', () => {
  it('computes one stage per thread from the state it carried before', async () => {
    const db = await seedBase();
    await addThread(db, { thread: 'closed', state: 'closed' });
    await addThread(db, { thread: 'publishing', state: 'publishing' });
    await addThread(db, { thread: 'later', state: 'fixed' });
    await addItem(db, { thread: 'later', approval: 'deferred' });
    await addThread(db, { thread: 'untouched', state: 'open' });
    await addItem(db, { thread: 'untouched', approval: 'none' });
    await addThread(db, { thread: 'working', state: 'working', attempt: 'running' });
    await addItem(db, { thread: 'working', approval: 'none' });
    await addThread(db, { thread: 'asking', state: 'needs_answer', question: 'Which retry?' });
    await addItem(db, { thread: 'asking', approval: 'none' });
    await addThread(db, { thread: 'fix', state: 'fixed', commitShas: '["4f21c8b"]' });
    await addItem(db, { thread: 'fix', approval: 'none' });
    await addThread(db, { thread: 'reply', state: 'answered', replyDraft: 'Kept on purpose.' });
    await addItem(db, { thread: 'reply', approval: 'none' });
    await addThread(db, { thread: 'integrated', state: 'fixed' });
    await addItem(db, { thread: 'integrated', approval: 'none', integratedSha: '9e8d7c6' });
    await addThread(db, { thread: 'run-failed', state: 'failed', attempt: 'failed' });
    await addItem(db, { thread: 'run-failed', approval: 'none' });
    await addThread(db, { thread: 'stopped', state: 'open', attempt: 'cancelled' });
    await addItem(db, { thread: 'stopped', approval: 'none' });
    await addThread(db, { thread: 'approved', state: 'fixed', commitShas: '["4f21c8b"]' });
    await addItem(db, { thread: 'approved', approval: 'accepted', approvedRevision: 1 });
    await addThread(db, { thread: 'wont-fix', state: 'answered', replyDraft: 'No.' });
    await addItem(db, { thread: 'wont-fix', approval: 'wont_fix', approvedRevision: 1 });
    await addThread(db, { thread: 'edited', state: 'fixed', revision: 3 });
    await addItem(db, { thread: 'edited', approval: 'accepted', approvedRevision: 1 });
    await addThread(db, { thread: 'delivered', state: 'fixed' });
    await addItem(db, {
      thread: 'delivered',
      approval: 'accepted',
      approvedRevision: 1,
      deliveredAt: 5,
    });
    await addReceipt(db, {
      thread: 'delivered',
      revision: 1,
      replyPhase: 'posted',
      resolvePhase: 'resolved',
    });
    await addThread(db, { thread: 'reply-failed', state: 'fixed' });
    await addItem(db, { thread: 'reply-failed', approval: 'accepted', approvedRevision: 1 });
    await addReceipt(db, {
      thread: 'reply-failed',
      revision: 1,
      replyPhase: 'pending',
      resolvePhase: 'pending',
      error: 'rate limited',
    });

    await migrate(db, migrations);

    expect(await stages(db)).toEqual({
      approved: 'approved',
      asking: 'asking',
      closed: 'resolved',
      delivered: 'resolved',
      edited: 'proposed',
      fix: 'proposed',
      integrated: 'proposed',
      later: 'parked',
      publishing: 'publishing',
      reply: 'proposed',
      'reply-failed': 'failed',
      'run-failed': 'failed',
      stopped: 'new',
      untouched: 'new',
      working: 'working',
      'wont-fix': 'approved',
    });
  });

  it('lands on the same stages when a crash makes it run a second time', async () => {
    const db = await seedBase();
    await addThread(db, { thread: 'fix', state: 'fixed', commitShas: '["4f21c8b"]' });
    await addItem(db, { thread: 'fix', approval: 'none' });
    await migrate(db, migrations);
    await db.execute('DELETE FROM schema_version WHERE version = 179');

    await migrate(db, migrations);

    expect(await stages(db)).toEqual({ fix: 'proposed' });
  });

  it('adds an empty holder and heartbeat to publications recorded before it', async () => {
    const db = await seedBase();

    await migrate(db, migrations);

    expect(await db.select('SELECT id, holder, heartbeat_at FROM resolve_publications')).toEqual([
      { id: 'publication', holder: null, heartbeat_at: null },
    ]);
  });

  it('rejects a stage the machine does not know', async () => {
    const db = await seedBase();
    await migrate(db, migrations);

    await expect(
      db.execute(`INSERT INTO resolve_threads
        (id, session_id, pr_number, thread_id, origin_kind, state, stage, created_at, updated_at)
        VALUES ('row', 'session', 1, 'thread', 'review_comment', 'open', 'fix_ready', 1, 1)`),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});
