import { describe, expect, it } from 'vitest';
import {
  claimAutoTree,
  getArtifact,
  getAutoArtifact,
  getAutoDelegation,
  insertAutoTree,
  listArtifactRevisions,
  listAutoArtifactVersions,
  listAutoReservations,
  setArtifactStatus,
  writeArtifactRevision,
} from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type AutoAttemptId,
  type AutoDelegationId,
  type AutoTreeId,
} from '@goodboy/types';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import {
  batchInput,
  childInput,
  makeAutoWorld,
  registerPlan,
  secondScheduler,
  startNewTurn,
  WORLD_NOW,
  WORLD_TREE,
  type AutoWorld,
} from './testing/autoWorld';
import type { LandRevisionParams } from './landRevision';

const plan1 = brandId<ArtifactId>({ value: 'plan-1' });
const planQ = brandId<ArtifactId>({ value: 'plan-q' });
const delegationRev = brandId<AutoDelegationId>({ value: 'delegation-rev' });
const attemptRev = brandId<AutoAttemptId>({ value: 'attempt-rev' });

const finishedRevise = async (): Promise<AutoWorld> => {
  const world = await makeAutoWorld({
    agentIds: ['agent-planner', 'agent-other'],
    planIds: [
      { id: 'plan-1', agentId: 'agent-planner' },
      { id: 'plan-q', agentId: 'agent-other' },
    ],
  });
  await registerPlan({ world, id: 'plan-1', agentId: 'agent-planner' });
  await world.scheduler.admit(
    batchInput({
      requestId: 'request-rev',
      children: [
        childInput({
          key: 'rev',
          role: 'planner',
          agentId: 'agent-planner',
          reviseOf: { artifactId: plan1, expectedRevision: 1 },
        }),
      ],
    }),
  );
  await world.scheduler.startAttempt({
    treeId: WORLD_TREE,
    delegationId: delegationRev,
    generation: 1,
    baseline: null,
    writeSet: null,
  });
  await world.scheduler.markAttemptRunning({
    attemptId: attemptRev,
    delegationId: delegationRev,
    generation: 1,
    runId: 'run-rev',
  });
  await world.scheduler.settleAttempt({
    attemptId: attemptRev,
    generation: 1,
    ending: {
      kind: 'ended',
      outcome: 'completed',
      endReason: 'ok',
      costUsd: 0.4,
      resultSnapshot: null,
    },
  });
  return world;
};

const landing = (patch: Partial<Omit<LandRevisionParams, 'db' | 'ownerId' | 'nowMs'>> = {}) => ({
  treeId: WORLD_TREE,
  delegationId: delegationRev,
  attemptId: attemptRev,
  generation: 1,
  artifactId: plan1,
  baseRevision: 1,
  ask: 'make step two smaller',
  sourceTurnId: 'turn-9',
  title: 'Plan for notify-relay',
  sourceText: '# Plan v2\n\n- step one\n- step two, smaller\n',
  metadata: {},
  result: { outcome: 'completed' },
  ...patch,
});

const versionCount = async ({ world }: { readonly world: AutoWorld }) =>
  (await listAutoArtifactVersions({ db: world.db, artifactId: plan1 })).length;

describe('landing a revision', () => {
  it('makes v2 of the same plan, with history, version, approval reset and a settled delegation', async () => {
    const world = await finishedRevise();
    const outcome = await world.scheduler.landRevision(landing());
    expect(outcome).toMatchObject({ kind: 'landed', revision: 2 });
    expect(await getArtifact({ db: world.db, artifactId: plan1 })).toMatchObject({
      id: 'plan-1',
      revision: 2,
      status: 'active',
      sourceText: '# Plan v2\n\n- step one\n- step two, smaller\n',
    });
    const history = await listArtifactRevisions({ db: world.db, artifactId: plan1 });
    expect(history.map((item) => [item.revision, item.author, item.ask])).toEqual([
      [2, 'agent', 'make step two smaller'],
      [1, 'agent', null],
    ]);
    expect(await listAutoArtifactVersions({ db: world.db, artifactId: plan1 })).toEqual([
      expect.objectContaining({ revision: 2, attemptId: 'attempt-rev', baseRevision: 1 }),
    ]);
    expect(await getAutoArtifact({ db: world.db, artifactId: plan1 })).toMatchObject({
      approvalState: 'needs_approval',
      approvedRevision: null,
      openReviseDelegationId: null,
    });
    expect(await getAutoDelegation({ db: world.db, delegationId: delegationRev })).toMatchObject({
      state: 'settled',
      outcome: 'completed',
      result: { outcome: 'completed' },
    });
  });

  it('leaves an unrelated active plan alone and adds no artifact', async () => {
    const world = await finishedRevise();
    const before = await world.db.select<{ count: number }>(
      'SELECT COUNT(*) AS count FROM session_artifacts',
    );
    await world.scheduler.landRevision(landing());
    const after = await world.db.select<{ count: number }>(
      'SELECT COUNT(*) AS count FROM session_artifacts',
    );
    expect(after).toEqual(before);
    expect(await getArtifact({ db: world.db, artifactId: planQ })).toMatchObject({
      revision: 1,
      status: 'active',
    });
  });

  it('clips the asked change to 240 characters', async () => {
    const world = await finishedRevise();
    await world.scheduler.landRevision(landing({ ask: 'x'.repeat(500) }));
    const history = await listArtifactRevisions({ db: world.db, artifactId: plan1 });
    expect(history[0]?.ask).toHaveLength(240);
  });

  it('is idempotent: a replay of the same attempt redelivers the landed version', async () => {
    const world = await finishedRevise();
    const first = await world.scheduler.landRevision(landing());
    const again = await world.scheduler.landRevision(landing());
    expect(again.kind).toBe('already_landed');
    expect(
      again.kind === 'already_landed' && first.kind === 'landed' ? again.contentHash : null,
    ).toBe(first.kind === 'landed' ? first.contentHash : undefined);
    expect((await getArtifact({ db: world.db, artifactId: plan1 }))?.revision).toBe(2);
    expect(await versionCount({ world })).toBe(1);
    expect(await listArtifactRevisions({ db: world.db, artifactId: plan1 })).toHaveLength(2);
  });

  it('rolls everything back when a late statement fails, and shows the error', async () => {
    const world = await finishedRevise();
    await world.db.exec(
      `CREATE TRIGGER fail_version_insert BEFORE INSERT ON auto_artifact_versions
       BEGIN SELECT RAISE(ABORT, 'version write failed'); END`,
    );
    await expect(world.scheduler.landRevision(landing())).rejects.toThrow('version write failed');
    expect(await getArtifact({ db: world.db, artifactId: plan1 })).toMatchObject({ revision: 1 });
    expect(await listArtifactRevisions({ db: world.db, artifactId: plan1 })).toHaveLength(1);
    expect(await getAutoArtifact({ db: world.db, artifactId: plan1 })).toMatchObject({
      approvalState: 'revising',
      openReviseDelegationId: 'delegation-rev',
    });
    expect((await getAutoDelegation({ db: world.db, delegationId: delegationRev }))?.state).toBe(
      'running',
    );
  });
});

describe('a late or stale result never merges into a newer version', () => {
  it('keeps a hand edit made during the revise and drops the landing as stale_base', async () => {
    const world = await finishedRevise();
    await writeArtifactRevision({
      db: world.db,
      artifactId: plan1,
      expectedRevision: 1,
      author: 'user',
      title: 'Plan for notify-relay',
      sourceText: '# Plan by hand\n',
      metadata: {},
      nowMs: WORLD_NOW,
    });
    const outcome = await world.scheduler.landRevision(landing());
    expect(outcome).toEqual({ kind: 'dropped', reason: 'stale_base' });
    expect((await getArtifact({ db: world.db, artifactId: plan1 }))?.sourceText).toBe(
      '# Plan by hand\n',
    );
    expect(await versionCount({ world })).toBe(0);
    const failed = await world.scheduler.failRevise({
      treeId: WORLD_TREE,
      delegationId: delegationRev,
      generation: 1,
      artifactId: plan1,
      reason: 'stale_base',
      result: { outcome: 'failed', reason: 'stale_base' },
    });
    expect(failed).toEqual({ kind: 'failed' });
    expect(await getAutoDelegation({ db: world.db, delegationId: delegationRev })).toMatchObject({
      state: 'settled',
      outcome: 'failed',
      reason: 'stale_base',
    });
    expect(await getAutoArtifact({ db: world.db, artifactId: plan1 })).toMatchObject({
      approvalState: 'needs_approval',
      openReviseDelegationId: null,
    });
  });

  it('drops the landing after the generation changed, and after a discard without a bump', async () => {
    const world = await finishedRevise();
    await setArtifactStatus({ db: world.db, artifactId: plan1, status: 'discarded', kind: 'plan' });
    expect(await world.scheduler.landRevision(landing())).toEqual({
      kind: 'dropped',
      reason: 'stale_base',
    });
    expect((await getArtifact({ db: world.db, artifactId: plan1 }))?.revision).toBe(1);
    await setArtifactStatus({ db: world.db, artifactId: plan1, status: 'active', kind: 'plan' });
    await world.scheduler.transition({
      treeId: WORLD_TREE,
      expect: { phaseRev: 3, generation: 1, from: ['delegating'] },
      to: 'stopping',
      patch: { isNewGeneration: true, stopState: 'requested' },
    });
    expect(await world.scheduler.landRevision(landing())).toEqual({
      kind: 'dropped',
      reason: 'generation',
    });
    expect(await versionCount({ world })).toBe(0);
  });

  it('refuses a landing before the attempt ended, from another window, and for another delegation', async () => {
    const world = await finishedRevise();
    await world.db.execute(
      "UPDATE auto_attempts SET state = 'running', outcome = NULL WHERE id = 'attempt-rev'",
    );
    expect(await world.scheduler.landRevision(landing())).toEqual({
      kind: 'dropped',
      reason: 'attempt',
    });
    await world.db.execute(
      "UPDATE auto_attempts SET state = 'ended', outcome = 'completed' WHERE id = 'attempt-rev'",
    );
    const other = secondScheduler({ world });
    expect(await other.landRevision(landing())).toEqual({ kind: 'dropped', reason: 'not_owner' });
    expect(
      await world.scheduler.landRevision(
        landing({ delegationId: brandId<AutoDelegationId>({ value: 'delegation-nope' }) }),
      ),
    ).toEqual({ kind: 'dropped', reason: 'delegation' });
    expect((await getArtifact({ db: world.db, artifactId: plan1 }))?.revision).toBe(1);
  });

  it('does not let an old failure clear a newer revise', async () => {
    const world = await finishedRevise();
    await world.scheduler.failRevise({
      treeId: WORLD_TREE,
      delegationId: delegationRev,
      generation: 1,
      artifactId: plan1,
      reason: 'no_new_version',
      result: { outcome: 'failed' },
    });
    await startNewTurn({ world, expectedPhaseRev: 4, from: ['delegating'] });
    const second = await world.scheduler.admit(
      batchInput({
        requestId: 'request-rev2',
        children: [
          childInput({
            key: 'rev2',
            role: 'planner',
            agentId: 'agent-planner',
            reviseOf: { artifactId: plan1, expectedRevision: 1 },
          }),
        ],
      }),
    );
    expect(second.kind).toBe('accepted');
    const lateOld = await world.scheduler.failRevise({
      treeId: WORLD_TREE,
      delegationId: delegationRev,
      generation: 1,
      artifactId: plan1,
      reason: 'no_new_version',
      result: { outcome: 'failed' },
    });
    expect(lateOld).toEqual({ kind: 'dropped' });
    expect(await getAutoArtifact({ db: world.db, artifactId: plan1 })).toMatchObject({
      approvalState: 'revising',
      openReviseDelegationId: 'delegation-rev2',
    });
  });
});

describe('failing and retrying a revise', () => {
  it('leaves the artifact at the last version waiting for approval and frees the reservation', async () => {
    const world = await makeAutoWorld({
      agentIds: ['agent-planner'],
      planIds: [{ id: 'plan-1', agentId: 'agent-planner' }],
    });
    await registerPlan({ world, id: 'plan-1', agentId: 'agent-planner' });
    await world.scheduler.admit(
      batchInput({
        requestId: 'request-rev',
        children: [
          childInput({
            key: 'rev',
            role: 'planner',
            agentId: 'agent-planner',
            reviseOf: { artifactId: plan1, expectedRevision: 1 },
          }),
        ],
      }),
    );
    const failed = await world.scheduler.failRevise({
      treeId: WORLD_TREE,
      delegationId: delegationRev,
      generation: 1,
      artifactId: plan1,
      reason: 'no_new_version',
      result: { outcome: 'failed', summary: 'the planner answered in prose' },
    });
    expect(failed).toEqual({ kind: 'failed' });
    expect(await getArtifact({ db: world.db, artifactId: plan1 })).toMatchObject({ revision: 1 });
    expect(await getAutoArtifact({ db: world.db, artifactId: plan1 })).toMatchObject({
      approvalState: 'needs_approval',
    });
    const reservations = await listAutoReservations({ db: world.db, treeId: WORLD_TREE });
    expect(reservations).toEqual([
      expect.objectContaining({ state: 'released', releasedReason: 'no_new_version' }),
    ]);
  });

  it('retries on a re-read base that includes the edit made in between', async () => {
    const world = await finishedRevise();
    await world.scheduler.failRevise({
      treeId: WORLD_TREE,
      delegationId: delegationRev,
      generation: 1,
      artifactId: plan1,
      reason: 'no_new_version',
      result: { outcome: 'failed' },
    });
    await writeArtifactRevision({
      db: world.db,
      artifactId: plan1,
      expectedRevision: 1,
      author: 'user',
      title: 'Plan for notify-relay',
      sourceText: '# Plan edited\n',
      metadata: {},
      nowMs: WORLD_NOW,
    });
    await startNewTurn({ world, expectedPhaseRev: 4, from: ['delegating'] });
    const stale = await world.scheduler.admit(
      batchInput({
        requestId: 'request-retry-old',
        children: [
          childInput({
            key: 'retry',
            role: 'planner',
            agentId: 'agent-planner',
            reviseOf: { artifactId: plan1, expectedRevision: 1 },
          }),
        ],
      }),
    );
    expect(stale).toMatchObject({ kind: 'refused', code: 'stale_revision' });
    const fresh = await world.scheduler.admit(
      batchInput({
        requestId: 'request-retry',
        children: [
          childInput({
            key: 'retry',
            role: 'planner',
            agentId: 'agent-planner',
            reviseOf: { artifactId: plan1, expectedRevision: 2 },
          }),
        ],
      }),
    );
    expect(fresh.kind).toBe('accepted');
  });
});

describe('a result names its own tree', () => {
  const otherTree = async (world: AutoWorld): Promise<AutoTreeId> => {
    await world.db.execute(
      "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent-auto-root-2', ?, 9, 'second auto', 'pending')",
      [AUTO_SEED_SESSION],
    );
    const id = brandId<AutoTreeId>({ value: 'tree-2' });
    await insertAutoTree({
      db: world.db,
      tree: {
        id,
        rootAgentId: brandId<AgentId>({ value: 'agent-auto-root-2' }),
        sessionId: AUTO_SEED_SESSION,
        primaryMountId: null,
        capUsd: 5,
        nowMs: WORLD_NOW,
        hardDeadlineAt: WORLD_NOW + 86_400_000,
      },
    });
    await claimAutoTree({
      db: world.db,
      treeId: id,
      ownerId: 'window-a',
      nowMs: WORLD_NOW,
      leaseMs: 30_000,
    });
    return id;
  };

  it('does not land or fail a delegation of another tree, and does not start it', async () => {
    const world = await finishedRevise();
    const foreign = await otherTree(world);
    expect(await world.scheduler.landRevision(landing({ treeId: foreign }))).toEqual({
      kind: 'dropped',
      reason: 'delegation',
    });
    expect(
      await world.scheduler.failRevise({
        treeId: foreign,
        delegationId: delegationRev,
        generation: 1,
        artifactId: plan1,
        reason: 'stale_base',
        result: {},
      }),
    ).toEqual({ kind: 'dropped' });
    expect(
      await world.scheduler.startAttempt({
        treeId: foreign,
        delegationId: delegationRev,
        generation: 1,
        baseline: null,
        writeSet: null,
      }),
    ).toEqual({ kind: 'refused', reason: 'unknown_delegation' });
    expect((await getArtifact({ db: world.db, artifactId: plan1 }))?.revision).toBe(1);
    expect(await getAutoDelegation({ db: world.db, delegationId: delegationRev })).toMatchObject({
      state: 'running',
    });
  });
});
