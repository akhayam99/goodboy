import { describe, expect, it } from 'vitest';
import {
  AUTO_ADMISSION_TREE_ABORT,
  autoAdmissionTreeStatement,
  getAutoTree,
  listAutoDelegations,
  listAutoReservations,
  readAutoTreeSpend,
} from '@goodboy/db';
import { AUTO_SEED_ROOT } from '@goodboy/db/test-helpers/auto-seeds';
import {
  batchInput,
  childInput,
  makeAutoWorld,
  secondScheduler,
  WORLD_NOW,
  WORLD_RUN,
  WORLD_TREE,
} from './testing/autoWorld';

const rowCounts = async ({
  world,
}: {
  readonly world: Awaited<ReturnType<typeof makeAutoWorld>>;
}) => ({
  delegations: (await listAutoDelegations({ db: world.db, treeId: WORLD_TREE })).length,
  reservations: (await listAutoReservations({ db: world.db, treeId: WORLD_TREE })).length,
});

describe('atomic admission', () => {
  it('accepts a batch in one step: delegations, reservations and the tree move together', async () => {
    const world = await makeAutoWorld();
    const outcome = await world.scheduler.admit(
      batchInput({
        children: [childInput({ key: 'a' }), childInput({ key: 'b', role: 'planner' })],
      }),
    );
    expect(outcome.kind).toBe('accepted');
    expect(outcome.kind === 'accepted' ? outcome.receipt.delegations : []).toEqual([
      expect.objectContaining({
        delegationId: 'delegation-a',
        childAgentId: 'agent-a',
        attemptId: 'attempt-a',
        ceilingUsd: 0.5,
        state: 'accepted',
      }),
      expect.objectContaining({
        delegationId: 'delegation-b',
        childAgentId: 'agent-b',
        attemptId: 'attempt-b',
        ceilingUsd: 0.75,
        state: 'accepted',
      }),
    ]);
    const tree = await getAutoTree({ db: world.db, treeId: WORLD_TREE });
    expect(tree).toMatchObject({
      phase: 'delegating',
      isYieldRequested: true,
      delegationsUsed: 2,
      attemptsUsed: 2,
      turnDelegateCalls: 1,
      refusalsUsed: 0,
      phaseRev: 2,
    });
    const rows = await listAutoDelegations({ db: world.db, treeId: WORLD_TREE });
    expect(
      rows.map((row) => [row.slot, row.childAgentId, row.role, row.state, row.batchId]),
    ).toEqual([
      [0, 'agent-a', 'scout', 'accepted', 'batch-request-1'],
      [1, 'agent-b', 'planner', 'accepted', 'batch-request-1'],
    ]);
    expect(rows[0]?.request).toMatchObject({
      capture: { mode: 'new' },
      task: 'look into a in ledger-core',
    });
    expect(rows[0]?.target).toEqual({ mountId: 'mount-ledger-core', revision: 'abc123' });
    expect(await readAutoTreeSpend({ db: world.db, treeId: WORLD_TREE })).toMatchObject({
      reservedUsd: 1.25,
      settledUsd: 0,
      remainingUsd: 3.75,
    });
  });

  it('answers the same receipt to the same request id and refuses the same id with other content', async () => {
    const world = await makeAutoWorld();
    const first = await world.scheduler.admit(batchInput({ children: [childInput({ key: 'a' })] }));
    const again = await world.scheduler.admit(batchInput({ children: [childInput({ key: 'a' })] }));
    expect(again.kind).toBe('replayed');
    expect(again.kind === 'replayed' && first.kind === 'accepted' ? again.receipt : null).toEqual(
      first.kind === 'accepted' ? first.receipt : undefined,
    );
    const other = await world.scheduler.admit(
      batchInput({ requestHash: 'hash-other', children: [childInput({ key: 'a' })] }),
    );
    expect(other).toMatchObject({ kind: 'refused', code: 'request_conflict' });
    expect(await rowCounts({ world })).toEqual({ delegations: 1, reservations: 1 });
  });

  it('writes nothing for a refused batch, and counts the refusal and the call', async () => {
    const world = await makeAutoWorld({ capUsd: 1 });
    const outcome = await world.scheduler.admit(
      batchInput({
        children: ['a', 'b', 'c'].map((key) => childInput({ key })),
      }),
    );
    expect(outcome).toMatchObject({ kind: 'refused', code: 'budget' });
    expect(await rowCounts({ world })).toEqual({ delegations: 0, reservations: 0 });
    const tree = await getAutoTree({ db: world.db, treeId: WORLD_TREE });
    expect(tree).toMatchObject({
      phase: 'deciding',
      isYieldRequested: false,
      delegationsUsed: 0,
      attemptsUsed: 0,
      refusalsUsed: 1,
      turnDelegateCalls: 1,
    });
  });

  it('admits what fits the cap after a refusal, in the same turn', async () => {
    const world = await makeAutoWorld({ capUsd: 1 });
    await world.scheduler.admit(
      batchInput({
        requestId: 'request-1',
        children: ['a', 'b', 'c'].map((key) => childInput({ key })),
      }),
    );
    const retry = await world.scheduler.admit(
      batchInput({
        requestId: 'request-2',
        children: ['a', 'b'].map((key) => childInput({ key })),
      }),
    );
    expect(retry.kind).toBe('accepted');
    expect(await rowCounts({ world })).toEqual({ delegations: 2, reservations: 2 });
    expect(await readAutoTreeSpend({ db: world.db, treeId: WORLD_TREE })).toMatchObject({
      reservedUsd: 1,
      remainingUsd: 0,
    });
  });

  it('refuses a second delegate call once the first returned its receipt', async () => {
    const world = await makeAutoWorld();
    await world.scheduler.admit(batchInput({ children: [childInput({ key: 'a' })] }));
    const second = await world.scheduler.admit(
      batchInput({ requestId: 'request-2', children: [childInput({ key: 'b' })] }),
    );
    expect(second).toMatchObject({ kind: 'refused', code: 'already_yielded' });
    expect(await rowCounts({ world })).toEqual({ delegations: 1, reservations: 1 });
  });

  it('lets exactly one of several parallel calls through', async () => {
    const world = await makeAutoWorld();
    const keys = ['a', 'b', 'c', 'd'];
    const outcomes = await Promise.all(
      keys.map((key) =>
        world.scheduler.admit(
          batchInput({ requestId: `request-${key}`, children: [childInput({ key })] }),
        ),
      ),
    );
    expect(outcomes.filter((outcome) => outcome.kind === 'accepted')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.kind === 'refused')).toHaveLength(3);
    expect(await rowCounts({ world })).toEqual({ delegations: 1, reservations: 1 });
    const tree = await getAutoTree({ db: world.db, treeId: WORLD_TREE });
    expect(tree?.refusalsUsed).toBe(3);
  });

  it('refuses a window that does not own the tree and writes nothing', async () => {
    const world = await makeAutoWorld();
    const other = secondScheduler({ world });
    const outcome = await other.admit(batchInput({ children: [childInput({ key: 'a' })] }));
    expect(outcome).toMatchObject({ kind: 'refused', code: 'not_owner' });
    expect(await rowCounts({ world })).toEqual({ delegations: 0, reservations: 0 });
    const tree = await getAutoTree({ db: world.db, treeId: WORLD_TREE });
    expect(tree).toMatchObject({ refusalsUsed: 0, phase: 'deciding' });
  });

  it('hands the tree to the second window once the lease ran out, and refuses the first', async () => {
    const world = await makeAutoWorld();
    const other = secondScheduler({ world });
    world.clock.advance({ ms: 31_000 });
    expect(await other.claim({ treeId: WORLD_TREE })).toBe(true);
    const old = await world.scheduler.admit(batchInput({ children: [childInput({ key: 'a' })] }));
    expect(old).toMatchObject({ kind: 'refused', code: 'not_owner' });
    const next = await other.admit(batchInput({ children: [childInput({ key: 'a' })] }));
    expect(next.kind).toBe('accepted');
  });

  it('keeps the breadth at four open children across turns', async () => {
    const world = await makeAutoWorld();
    await world.scheduler.admit(
      batchInput({
        requestId: 'request-1',
        children: ['a', 'b', 'c'].map((key) => childInput({ key })),
      }),
    );
    await world.scheduler.transition({
      treeId: WORLD_TREE,
      expect: { phaseRev: 2, generation: 1, from: ['delegating'] },
      to: 'deciding',
      patch: { isYieldRequested: false, isNewTurn: true },
    });
    const tooMany = await world.scheduler.admit(
      batchInput({
        requestId: 'request-2',
        children: ['d', 'e'].map((key) => childInput({ key })),
      }),
    );
    expect(tooMany).toMatchObject({ kind: 'refused', code: 'breadth_cap' });
    const fits = await world.scheduler.admit(
      batchInput({ requestId: 'request-3', children: [childInput({ key: 'd' })] }),
    );
    expect(fits.kind).toBe('accepted');
    expect(await rowCounts({ world })).toEqual({ delegations: 4, reservations: 4 });
  });

  it('refuses an old generation, a stop in progress and another run', async () => {
    const world = await makeAutoWorld();
    const old = await world.scheduler.admit(
      batchInput({ generation: 2, children: [childInput({ key: 'a' })] }),
    );
    expect(old).toMatchObject({ kind: 'refused', code: 'generation_changed' });
    const wrongRun = await world.scheduler.admit(
      batchInput({ runId: 'run-other', children: [childInput({ key: 'a' })] }),
    );
    expect(wrongRun).toMatchObject({ kind: 'refused', code: 'not_deciding' });
    await world.db.execute("UPDATE auto_trees SET stop_state = 'requested' WHERE id = ?", [
      WORLD_TREE,
    ]);
    const stopped = await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a' })] }),
    );
    expect(stopped).toMatchObject({ kind: 'refused', code: 'tree_stopped' });
  });

  describe('the sql guard holds on its own, whatever the snapshot said', () => {
    const statement = async ({
      requestedUsd,
      count,
    }: {
      readonly requestedUsd: number;
      readonly count: number;
    }) => {
      const world = await makeAutoWorld();
      const guard = autoAdmissionTreeStatement({
        treeId: WORLD_TREE,
        rootAgentId: AUTO_SEED_ROOT,
        ownerId: 'window-a',
        nowMs: WORLD_NOW,
        generation: 1,
        runId: WORLD_RUN,
        grants: 0,
        count,
        requestedUsd,
        limits: {
          maxCallsPerTurn: 6,
          maxRefusals: 10,
          maxDelegations: 12,
          maxAttempts: 20,
          maxOpenChildren: 4,
        },
      });
      return world.db.transaction({ statements: [guard] });
    };

    it('commits inside the cap and the breadth', async () => {
      expect((await statement({ requestedUsd: 5, count: 4 })).status).toBe('committed');
    });

    it('aborts above the cap', async () => {
      expect(await statement({ requestedUsd: 5.01, count: 1 })).toMatchObject({
        status: 'aborted',
        abortCode: AUTO_ADMISSION_TREE_ABORT,
      });
    });

    it('aborts above the breadth', async () => {
      expect(await statement({ requestedUsd: 1, count: 5 })).toMatchObject({
        status: 'aborted',
        abortCode: AUTO_ADMISSION_TREE_ABORT,
      });
    });
  });

  it('stops at the lifetime counter that tripped, and a grant raises it', async () => {
    const world = await makeAutoWorld();
    await world.db.execute('UPDATE auto_trees SET delegations_used = 12 WHERE id = ?', [
      WORLD_TREE,
    ]);
    const blocked = await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a' })] }),
    );
    expect(blocked).toMatchObject({ kind: 'refused', code: 'limit_delegations' });
    await world.db.execute('UPDATE auto_trees SET grants = 1 WHERE id = ?', [WORLD_TREE]);
    const granted = await world.scheduler.admit(
      batchInput({ requestId: 'request-2', children: [childInput({ key: 'a' })] }),
    );
    expect(granted.kind).toBe('accepted');
  });
});
