import { describe, expect, it } from 'vitest';
import {
  getAutoOutbox,
  getAutoTree,
  listAutoAttemptsOfTree,
  listAutoDelegations,
} from '@goodboy/db';
import { brandId, type AutoOutboxId } from '@goodboy/types';
import { deliverNext } from './deliver';
import { addUserRow } from './testing/deliveryWorld';
import {
  autoDelegates,
  autoTurnEnds,
  makeRuntimeWorld,
  restartedWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const outboxId = (value: string) => brandId<AutoOutboxId>({ value });

const THREE_WRITERS = {
  children: [
    { role: 'implementer', task: 'add the export', reason: 'code', mount: 'mount-ledger-core' },
    { role: 'tester', task: 'test the export', reason: 'tests', mount: 'mount-notify-relay' },
    { role: 'docs', task: 'document the export', reason: 'docs', mount: 'mount-notify-relay' },
  ],
};

const treeOf = async (world: RuntimeWorld) =>
  getAutoTree({ db: world.state.world.db, treeId: world.treeId });

const done = (childAgentId: string, text = 'Finished.') =>
  `${text}\n<<step-done id="${childAgentId}">>`;

const runningChildren = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
  await autoDelegates({ world, spec: THREE_WRITERS });
  await autoTurnEnds({ world });
  for (const turn of world.state.ports.childTurns) {
    world.state.ports.liveRuns.add(turn.runId);
  }
  return world;
};

describe('recovering a delivery that was claimed', () => {
  it('releases the claim and redelivers the identical text when no run ever existed', async () => {
    const world = await makeRuntimeWorld();
    await addUserRow({ world: world.state.world, id: 'outbox-user-1', text: 'hello Auto' });
    world.state.ports.setAutoTurnHang('before_register');
    void deliverNext({ ctx: world.state.ctx, treeId: world.treeId, onEnded: world.state.onEnded });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const firstText = world.state.ports.autoTurns[0]?.text ?? '';
    expect(
      await getAutoOutbox({ db: world.state.world.db, outboxId: outboxId('outbox-user-1') }),
    ).toMatchObject({
      state: 'claimed',
    });

    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(restarted.state.ports.autoTurns).toHaveLength(1);
    expect(restarted.state.ports.autoTurns[0]?.text).toBe(firstText);
    expect(restarted.state.ports.autoTurns[0]?.deliveryId).toBe('outbox-user-1');
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding', turnsUsed: 1 });
    expect(
      await getAutoOutbox({ db: world.state.world.db, outboxId: outboxId('outbox-user-1') }),
    ).toMatchObject({
      state: 'accepted',
    });
  });

  it('commits the acceptance and watches the run when the registry already holds it', async () => {
    const world = await makeRuntimeWorld();
    await addUserRow({ world: world.state.world, id: 'outbox-user-1', text: 'hello Auto' });
    world.state.ports.setAutoTurnHang('after_register');
    void deliverNext({ ctx: world.state.ctx, treeId: world.treeId, onEnded: world.state.onEnded });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const run = world.state.ports.autoTurns[0]?.runId ?? '';

    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);

    expect(restarted.state.ports.autoTurns).toHaveLength(0);
    expect(
      await getAutoOutbox({ db: world.state.world.db, outboxId: outboxId('outbox-user-1') }),
    ).toMatchObject({
      state: 'accepted',
      acceptedRunId: run,
    });

    restarted.state.ports.liveRuns.delete(run);
    restarted.state.ports.runOutcomes.set(run, {
      assistantText: 'Here is the answer.',
      exit: 'ok',
      costUsd: 0.1,
    });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(await treeOf(world)).toMatchObject({ phase: 'answering', activeRunId: null });
  });

  it('puts the batch back for one more try when the turn is gone without an answer', async () => {
    const world = await makeRuntimeWorld();
    await userSays({ world, id: 'outbox-user-1', text: 'hello Auto' });
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding' });

    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(restarted.state.ports.autoTurns).toHaveLength(1);
    expect(restarted.state.ports.autoTurns[0]?.text).toContain(
      'Goodboy restarted while you were answering',
    );
    expect(restarted.state.ports.autoTurns[0]?.text).toContain('hello Auto');
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding', noProgressStreak: 1 });
  });
});

describe('recovering the children of a tree', () => {
  it('finishes a child that ended while the window was away and joins the batch', async () => {
    const world = await runningChildren();
    const turns = world.state.ports.childTurns;
    for (const [index, turn] of turns.entries()) {
      world.state.ports.liveRuns.delete(turn.runId);
      world.state.ports.runOutcomes.set(turn.runId, {
        assistantText: done(turn.childAgentId, `Child ${index} is done.`),
        exit: 'ok',
        costUsd: 0.2,
      });
    }

    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(restarted.state.ports.autoTurns).toHaveLength(1);
    const text = restarted.state.ports.autoTurns[0]?.text ?? '';
    expect(text).toContain('Child 0 is done.');
    expect(text).toContain('Child 2 is done.');
    const delegations = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegations.every((delegation) => delegation.outcome === 'completed')).toBe(true);
  });

  it('keeps watching a child whose run is still live and finishes it when it ends', async () => {
    const world = await runningChildren();
    const restarted = restartedWorld({ world });

    await restarted.runtime.recover(world.treeId);
    expect(restarted.state.ports.autoTurns).toHaveLength(0);

    for (const turn of world.state.ports.childTurns) {
      restarted.state.ports.liveRuns.delete(turn.runId);
      restarted.state.ports.runOutcomes.set(turn.runId, {
        assistantText: done(turn.childAgentId),
        exit: 'ok',
        costUsd: 0.2,
      });
    }
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(restarted.state.ports.autoTurns).toHaveLength(1);
  });

  it('fails the child that was interrupted, keeps the two that settled, and reports all three', async () => {
    const world = await runningChildren();
    const [first, second, third] = world.state.ports.childTurns;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('three children were expected');
    }
    for (const turn of [first, second]) {
      world.state.ports.childTurns.length = 3;
      turn.onEnded({
        treeId: turn.treeId,
        generation: turn.generation,
        delegationId: turn.delegationId,
        attemptId: turn.attemptId,
        runId: turn.runId,
        childAgentId: turn.childAgentId,
        sessionId: turn.sessionId,
        assistantText: done(turn.childAgentId),
        exit: 'ok',
        costUsd: 0.2,
        filesTouched: [],
        durationMs: 10,
      });
    }
    await world.runtime.settled();
    expect(world.state.ports.autoTurns).toHaveLength(1);
    world.state.ports.liveRuns.delete(third.runId);

    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(restarted.state.ports.autoTurns).toHaveLength(1);
    expect(restarted.state.ports.autoTurns[0]?.text).toContain(': failed, interrupted');
    const delegations = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegations.map((delegation) => delegation.outcome).sort()).toEqual([
      'completed',
      'completed',
      'failed',
    ]);
  });

  it('starts a child whose attempt never got a run exactly once, and not twice when two windows recover', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
    await autoDelegates({ world, spec: { children: [THREE_WRITERS.children[0]] } });
    await world.state.world.db.execute(
      `UPDATE auto_trees SET active_run_id = NULL, active_delivery_id = NULL, phase = 'delegating'`,
    );
    const restarted = restartedWorld({ world });
    const rival = restartedWorld({ world });

    await Promise.all([
      restarted.runtime.recover(world.treeId),
      rival.runtime.recover(world.treeId),
    ]);
    await restarted.runtime.settled();
    await rival.runtime.settled();

    const started = restarted.state.ports.childTurns.length + rival.state.ports.childTurns.length;
    expect(started).toBe(1);
    const attempts = await listAutoAttemptsOfTree({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ state: 'running' });
  });

  it('does nothing while the old window still holds the lease, and recovers once it lapses', async () => {
    const world = await runningChildren();
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }
    world.state.ports.liveRuns.delete(turn.runId);
    world.state.ports.runOutcomes.set(turn.runId, {
      assistantText: done(turn.childAgentId, 'Child 0 is done.'),
      exit: 'ok',
      costUsd: 0.2,
    });
    const early = restartedWorld({ world, isLeaseLapsed: false });

    expect(await early.runtime.recover(world.treeId)).toBe(false);
    await early.runtime.settled();
    expect(
      (await listAutoAttemptsOfTree({ db: world.state.world.db, treeId: world.treeId })).filter(
        (attempt) => attempt.state === 'ended',
      ),
    ).toHaveLength(0);

    world.state.world.clock.advance({ ms: 31_000 });
    expect(await early.runtime.recover(world.treeId)).toBe(true);
    await early.runtime.settled();

    expect(
      (await listAutoAttemptsOfTree({ db: world.state.world.db, treeId: world.treeId })).filter(
        (attempt) => attempt.state === 'ended',
      ),
    ).toHaveLength(1);
  });
});
