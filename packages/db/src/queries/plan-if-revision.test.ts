import { describe, expect, it } from 'vitest';
import type { AgentId, PlanId, SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { getArtifact, updateArtifactSource } from './artifact';
import { listArtifactRevisions } from './artifactRevision';
import { listPlansForSession, updatePlanBodyIfRevision, upsertPlan } from './plan';

const sessionId = 't1' as SessionId;
const planId = 'p1' as PlanId;

const seedPlan = async () => {
  const db = await makeMigratedTestDatabase();
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ['w1', 'Harborline', '/tmp/harborline', now, now],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ['t1', 'w1', 'Retry payments through ledger-core', 'idle', now, now],
  );
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, ?, ?, ?)`,
    ['a1', 't1', 0, 'Planner', 'pending'],
  );
  await upsertPlan(db, {
    id: planId,
    sessionId,
    agentId: 'a1' as AgentId,
    title: 'Retry with backoff',
    bodyMd: '1. Add backoff',
  });
  return db;
};

type TestDb = Awaited<ReturnType<typeof seedPlan>>;

const revisionOf = async (db: TestDb) => (await getArtifact({ db, artifactId: planId }))?.revision;

const plannerWrites = async ({
  db,
  title,
  sourceText,
  metadata = {},
}: {
  readonly db: TestDb;
  readonly title: string;
  readonly sourceText: string;
  readonly metadata?: Parameters<typeof updateArtifactSource>[0]['input']['metadata'];
}) =>
  updateArtifactSource({
    db,
    input: {
      id: planId,
      title,
      sourceFormat: 'markdown',
      sourceText,
      metadata,
      note: { author: 'agent' },
    },
  });

describe('updatePlanBodyIfRevision', () => {
  it('saves against the revision it started from and bumps it with author user', async () => {
    const db = await seedPlan();

    const result = await updatePlanBodyIfRevision(
      db,
      planId,
      'Retry twice',
      '1. Add backoff\n2. Test it',
      1,
    );

    expect(result).toEqual({ kind: 'saved', revision: 2 });
    const [plan] = await listPlansForSession(db, sessionId);
    expect(plan?.title).toBe('Retry twice');
    expect(plan?.bodyMd).toBe('1. Add backoff\n2. Test it');
    expect(await revisionOf(db)).toBe(2);
    const revisions = await listArtifactRevisions({ db, artifactId: planId });
    expect(revisions.map((revision) => [revision.revision, revision.author])).toEqual([
      [2, 'user'],
      [1, 'agent'],
    ]);
  });

  it('answers conflict and writes nothing when the planner wrote meanwhile', async () => {
    const db = await seedPlan();
    await plannerWrites({ db, title: 'Retry with jitter', sourceText: '1. Add jitter' });

    const result = await updatePlanBodyIfRevision(db, planId, 'My edit', 'my text', 1);

    expect(result).toEqual({ kind: 'conflict', revision: 2 });
    const [plan] = await listPlansForSession(db, sessionId);
    expect(plan?.title).toBe('Retry with jitter');
    expect(plan?.bodyMd).toBe('1. Add jitter');
    const revisions = await listArtifactRevisions({ db, artifactId: planId });
    expect(revisions.map((revision) => revision.revision)).toEqual([2, 1]);
  });

  it('refuses a second save from the same revision', async () => {
    const db = await seedPlan();
    await updatePlanBodyIfRevision(db, planId, 'First edit', 'one', 1);

    const second = await updatePlanBodyIfRevision(db, planId, 'Second edit', 'two', 1);

    expect(second).toEqual({ kind: 'conflict', revision: 2 });
    expect((await listPlansForSession(db, sessionId))[0]?.bodyMd).toBe('one');
  });

  it('keeps the parts the run fans out from', async () => {
    const db = await seedPlan();
    await plannerWrites({
      db,
      title: 'Retry with backoff',
      sourceText: 'two parts',
      metadata: {
        clusters: [
          { title: 'payments-api', instructions: 'Add backoff' },
          { title: 'notify-relay', instructions: 'Add jitter' },
        ],
      },
    });

    await updatePlanBodyIfRevision(db, planId, 'Retry with backoff', 'two parts, reworded', 2);

    const [plan] = await listPlansForSession(db, sessionId);
    expect(plan?.clusters?.map((cluster) => cluster.title)).toEqual([
      'payments-api',
      'notify-relay',
    ]);
  });

  it('throws for a plan that does not exist', async () => {
    const db = await seedPlan();

    await expect(updatePlanBodyIfRevision(db, 'missing' as PlanId, 'x', 'y', 1)).rejects.toThrow(
      'Plan not found',
    );
  });
});
