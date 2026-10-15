import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@goodboy/core';
import {
  getArtifact,
  getAutoArtifact,
  getAutoDelegation,
  listAutoDelegations,
  listAutoReservations,
  setArtifactStatus,
  writeArtifactRevision,
} from '@goodboy/db';
import { brandId, type ArtifactId, type AutoDelegationId } from '@goodboy/types';
import { approveArtifact } from './approveArtifact';
import {
  batchInput,
  childInput,
  makeAutoWorld,
  planRef,
  registerPlan,
  startNewTurn,
  WORLD_NOW,
  WORLD_TREE,
  type AutoWorld,
} from './testing/autoWorld';

const PLAN_SOURCE = '# Plan\n\n- step one\n- step two\n';
const plan1 = brandId<ArtifactId>({ value: 'plan-1' });
const plan2 = brandId<ArtifactId>({ value: 'plan-2' });
const other = brandId<ArtifactId>({ value: 'plan-q' });

type WorldWithPlans = {
  readonly capUsd?: number;
};

const worldWithPlans = async ({ capUsd }: WorldWithPlans = {}): Promise<AutoWorld> => {
  const world = await makeAutoWorld({
    capUsd,
    agentIds: ['agent-planner', 'agent-other'],
    planIds: [
      { id: 'plan-1', agentId: 'agent-planner' },
      { id: 'plan-2', agentId: 'agent-planner' },
      { id: 'plan-q', agentId: 'agent-other' },
    ],
  });
  await registerPlan({ world, id: 'plan-1', agentId: 'agent-planner' });
  await registerPlan({ world, id: 'plan-2', agentId: 'agent-planner' });
  return world;
};

type ReviseParams = {
  readonly key?: string;
  readonly artifact?: ArtifactId;
  readonly revision?: number;
  readonly requestId?: string;
  readonly isConfirmForced?: boolean;
};

const reviseBatch = ({
  key = 'rev',
  artifact = plan1,
  revision = 1,
  requestId = 'request-rev',
  isConfirmForced = false,
}: ReviseParams = {}) =>
  batchInput({
    requestId,
    children: [
      childInput({
        key,
        role: 'planner',
        agentId: 'agent-planner',
        reviseOf: { artifactId: artifact, expectedRevision: revision },
        isConfirmForced,
      }),
    ],
  });

const liveRevision = async ({
  world,
  id,
}: {
  readonly world: AutoWorld;
  readonly id: ArtifactId;
}): Promise<number | undefined> => (await getArtifact({ db: world.db, artifactId: id }))?.revision;

describe('revise admission', () => {
  it('sends the revise to the producer on its role, with the base pinned by hash', async () => {
    const world = await worldWithPlans();
    const outcome = await world.scheduler.admit(reviseBatch());
    expect(outcome.kind).toBe('accepted');
    const delegation = await getAutoDelegation({
      db: world.db,
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-rev' }),
    });
    expect(delegation).toMatchObject({
      childAgentId: 'agent-planner',
      role: 'planner',
      reviseOf: 'plan-1',
      baseRevision: 1,
      state: 'accepted',
    });
    expect(delegation?.request).toMatchObject({
      capture: {
        mode: 'revise',
        artifactId: 'plan-1',
        baseRevision: 1,
        contentHash: sha256Hex(PLAN_SOURCE),
      },
    });
    expect(await getAutoArtifact({ db: world.db, artifactId: plan1 })).toMatchObject({
      approvalState: 'revising',
      approvedRevision: null,
      openReviseDelegationId: 'delegation-rev',
    });
  });

  it('targets the right artifact when one producer owns two', async () => {
    const world = await worldWithPlans();
    await world.scheduler.admit(reviseBatch({ artifact: plan2 }));
    expect(await getAutoArtifact({ db: world.db, artifactId: plan1 })).toMatchObject({
      approvalState: 'needs_approval',
      openReviseDelegationId: null,
    });
    expect(await getAutoArtifact({ db: world.db, artifactId: plan2 })).toMatchObject({
      approvalState: 'revising',
      openReviseDelegationId: 'delegation-rev',
    });
    expect(await liveRevision({ world, id: plan1 })).toBe(1);
    expect(await liveRevision({ world, id: other })).toBe(1);
  });

  it('refuses with typed codes and writes nothing', async () => {
    const world = await worldWithPlans();
    const stale = await world.scheduler.admit(reviseBatch({ revision: 3 }));
    expect(stale).toMatchObject({ kind: 'refused', code: 'stale_revision' });
    expect(stale.kind === 'refused' ? stale.perChild : []).toEqual([
      { slot: 0, code: 'stale_revision', latestRevision: 1 },
    ]);
    const unknown = await world.scheduler.admit(
      reviseBatch({ requestId: 'request-2', artifact: other }),
    );
    expect(unknown).toMatchObject({ kind: 'refused', code: 'artifact_unknown' });
    const wrongRole = await world.scheduler.admit(
      batchInput({
        requestId: 'request-3',
        children: [
          childInput({
            key: 'rev',
            role: 'scout',
            agentId: 'agent-planner',
            reviseOf: { artifactId: plan1, expectedRevision: 1 },
          }),
        ],
      }),
    );
    expect(wrongRole).toMatchObject({ kind: 'refused', code: 'role_mismatch' });
    await setArtifactStatus({ db: world.db, artifactId: plan2, status: 'discarded', kind: 'plan' });
    const discarded = await world.scheduler.admit(
      reviseBatch({ requestId: 'request-4', artifact: plan2 }),
    );
    expect(discarded).toMatchObject({ kind: 'refused', code: 'artifact_discarded' });
    expect(await listAutoDelegations({ db: world.db, treeId: WORLD_TREE })).toEqual([]);
    expect(await listAutoReservations({ db: world.db, treeId: WORLD_TREE })).toEqual([]);
  });

  it('refuses a second revise of the same artifact while one is open', async () => {
    const world = await worldWithPlans();
    await world.scheduler.admit(reviseBatch());
    await startNewTurn({ world, expectedPhaseRev: 2, from: ['delegating'] });
    const second = await world.scheduler.admit(
      reviseBatch({ key: 'again', requestId: 'request-again' }),
    );
    expect(second).toMatchObject({ kind: 'refused', code: 'artifact_busy' });
  });

  it('waits for the user on a forced confirm and holds only its reservation', async () => {
    const world = await worldWithPlans();
    const outcome = await world.scheduler.admit(reviseBatch({ isConfirmForced: true }));
    expect(outcome.kind === 'accepted' ? outcome.receipt.delegations[0]?.state : null).toBe(
      'awaiting_confirm',
    );
    const delegation = await getAutoDelegation({
      db: world.db,
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-rev' }),
    });
    expect(delegation?.state).toBe('awaiting_confirm');
    const reservations = await listAutoReservations({ db: world.db, treeId: WORLD_TREE });
    expect(reservations).toEqual([
      expect.objectContaining({ state: 'reserved', ownerId: 'attempt-rev' }),
    ]);
    const attempts = await world.db.select('SELECT id FROM auto_attempts');
    expect(attempts).toEqual([]);
  });
});

describe('approval belongs to a revision', () => {
  const implementerBatch = ({
    revision,
    requestId = 'request-impl',
    isConfirmForced = false,
  }: {
    readonly revision: number;
    readonly requestId?: string;
    readonly isConfirmForced?: boolean;
  }) =>
    batchInput({
      requestId,
      children: [
        childInput({
          key: 'impl',
          role: 'implementer',
          inputArtifacts: [planRef({ id: 'plan-1', revision })],
          isConfirmForced,
        }),
      ],
    });

  it('lets a writer take the plan only after the approval of that revision', async () => {
    const world = await worldWithPlans();
    const early = await world.scheduler.admit(implementerBatch({ revision: 1 }));
    expect(early).toMatchObject({ kind: 'refused', code: 'artifact_unapproved' });
    expect(await approveArtifact({ db: world.db, artifactId: plan1, expectedRevision: 1 })).toEqual(
      {
        kind: 'approved',
        revision: 1,
      },
    );
    const admitted = await world.scheduler.admit(
      implementerBatch({ revision: 1, requestId: 'request-impl-2' }),
    );
    expect(admitted.kind).toBe('accepted');
    expect((await getArtifact({ db: world.db, artifactId: plan1 }))?.status).toBe('consumed');
    const delegation = await getAutoDelegation({
      db: world.db,
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-impl' }),
    });
    expect(delegation?.request).toMatchObject({
      inputArtifacts: [{ artifactId: 'plan-1', revision: 1, contentHash: sha256Hex(PLAN_SOURCE) }],
    });
  });

  it('turns an approval into nothing when anyone writes a newer revision', async () => {
    const world = await worldWithPlans();
    await approveArtifact({ db: world.db, artifactId: plan1, expectedRevision: 1 });
    await writeArtifactRevision({
      db: world.db,
      artifactId: plan1,
      expectedRevision: 1,
      author: 'user',
      title: 'Plan for notify-relay',
      sourceText: '# Plan v2\n',
      metadata: {},
      nowMs: WORLD_NOW,
    });
    const stale = await world.scheduler.admit(implementerBatch({ revision: 1 }));
    expect(stale).toMatchObject({ kind: 'refused', code: 'stale_revision' });
    const fresh = await world.scheduler.admit(
      implementerBatch({ revision: 2, requestId: 'request-impl-2' }),
    );
    expect(fresh).toMatchObject({ kind: 'refused', code: 'artifact_unapproved' });
    expect(
      await approveArtifact({ db: world.db, artifactId: plan1, expectedRevision: 1 }),
    ).toMatchObject({
      kind: 'refused',
      code: 'stale_revision',
      latestRevision: 2,
    });
  });

  it('answers a click on the old revision with the typed code, never an approval', async () => {
    const world = await worldWithPlans();
    await world.scheduler.admit(reviseBatch());
    const during = await approveArtifact({ db: world.db, artifactId: plan1, expectedRevision: 1 });
    expect(during).toEqual({ kind: 'refused', code: 'artifact_revising', latestRevision: 1 });
  });

  it('lets exactly one of approve and revise win when they race', async () => {
    const world = await worldWithPlans();
    const [approved, revised] = await Promise.all([
      approveArtifact({ db: world.db, artifactId: plan1, expectedRevision: 1 }),
      world.scheduler.admit(reviseBatch()),
    ]);
    const artifact = await getAutoArtifact({ db: world.db, artifactId: plan1 });
    if (approved.kind === 'approved') {
      expect(revised.kind).toBe('accepted');
      expect(artifact?.approvalState).toBe('revising');
      expect(artifact?.approvedRevision).toBeNull();
    } else {
      expect(approved).toMatchObject({ kind: 'refused', code: 'artifact_revising' });
      expect(revised.kind).toBe('accepted');
    }
  });

  it('lets a revise void an approval that was given first', async () => {
    const world = await worldWithPlans();
    await approveArtifact({ db: world.db, artifactId: plan1, expectedRevision: 1 });
    const revised = await world.scheduler.admit(reviseBatch());
    expect(revised.kind).toBe('accepted');
    expect(await getAutoArtifact({ db: world.db, artifactId: plan1 })).toMatchObject({
      approvalState: 'revising',
      approvedRevision: null,
    });
  });

  it('refuses a revise once an implementer took the plan', async () => {
    const world = await worldWithPlans();
    await approveArtifact({ db: world.db, artifactId: plan1, expectedRevision: 1 });
    await world.scheduler.admit(implementerBatch({ revision: 1 }));
    await startNewTurn({ world, expectedPhaseRev: 2, from: ['delegating'] });
    const late = await world.scheduler.admit(reviseBatch({ requestId: 'request-late' }));
    expect(late).toMatchObject({ kind: 'refused', code: 'artifact_consumed' });
  });

  it('skips the approval when the confirm card is off, but keeps the pinned revision', async () => {
    const world = await worldWithPlans();
    const outcome = await world.scheduler.admit(
      batchInput({
        children: [
          childInput({
            key: 'impl',
            role: 'implementer',
            inputArtifacts: [planRef({ id: 'plan-1', revision: 1 })],
          }),
        ],
        isPlanApprovalRequired: false,
      }),
    );
    expect(outcome.kind).toBe('accepted');
  });

  it('drops the confirm cards that wait on a plan when that plan starts a revise', async () => {
    const world = await worldWithPlans();
    await world.scheduler.admit(
      batchInput({
        requestId: 'request-review',
        children: [
          childInput({
            key: 'review',
            role: 'reviewer',
            isConfirmForced: true,
            inputArtifacts: [planRef({ id: 'plan-1', revision: 1 })],
          }),
        ],
      }),
    );
    await startNewTurn({ world, expectedPhaseRev: 2, from: ['delegating'] });
    const revise = await world.scheduler.admit(reviseBatch());
    expect(revise.kind).toBe('accepted');
    const review = await getAutoDelegation({
      db: world.db,
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-review' }),
    });
    expect(review).toMatchObject({
      state: 'settled',
      outcome: 'stopped',
      reason: 'revise_started',
    });
    const reservations = await listAutoReservations({ db: world.db, treeId: WORLD_TREE });
    expect(
      reservations
        .map((row) => [row.ownerId, row.state, row.releasedReason])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toEqual([
      ['attempt-rev', 'reserved', null],
      ['attempt-review', 'released', 'revise_started'],
    ]);
  });
});
