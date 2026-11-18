import { describe, expect, it } from 'vitest';
import { AUTO_DELEGATION_DEADLINE_MINUTES } from '@goodboy/core/auto';
import { countAutoRunningChildren, listAutoDelegations } from '@goodboy/db';
import {
  childTurnEnds,
  makeRuntimeWorld,
  restartedWorld,
  autoTurnEndsWithBlock,
  userSays,
  type RuntimeWorld,
} from '../testing/runtimeWorld';

const SIX_SCOUTS = {
  action: 'delegate',
  requestId: 'request-six',
  children: ['a', 'b', 'c', 'd', 'e', 'f'].map((area) => ({
    role: 'scout',
    task: `map area ${area} of ledger-core`,
    reason: 'reading code',
  })),
};

const done = (childAgentId: string) =>
  `Mapped it.\n<<artifact v=1 kind=report>>\n{"title":"Area map","format":"markdown","content":"mapped"}\n<</artifact>>\n<<step-done id="${childAgentId}">>`;

const started = async () => {
  const world = await makeRuntimeWorld({ capUsd: 20 });
  await userSays({ world, id: 'outbox-user-1', text: 'map every area of ledger-core' });
  await autoTurnEndsWithBlock({ world, block: SIX_SCOUTS });
  return world;
};

const rowsOf = (world: RuntimeWorld) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

const waitingOf = async (world: RuntimeWorld) =>
  (await rowsOf(world)).filter((row) => row.state === 'accepted').length;

const runningOf = (world: RuntimeWorld) =>
  countAutoRunningChildren({ db: world.state.world.db, treeId: world.treeId });

const endChild = async (world: RuntimeWorld, index: number) => {
  const turn = world.state.ports.childTurns[index];
  if (turn === undefined) {
    throw new Error(`child turn ${index} was expected`);
  }
  await childTurnEnds({ world, index, text: done(String(turn.childAgentId)) });
};

describe('children past the four running slots', () => {
  it('admits six, starts four and the other two one by one as running ones end', async () => {
    const world = await started();

    expect(await rowsOf(world)).toHaveLength(6);
    expect(world.state.ports.childTurns).toHaveLength(4);
    expect(await runningOf(world)).toBe(4);
    expect(await waitingOf(world)).toBe(2);

    world.state.world.clock.advance({ ms: 10 * 60_000 });
    await world.runtime.drive(world.treeId);
    await endChild(world, 0);

    expect(world.state.ports.childTurns).toHaveLength(5);
    expect(await runningOf(world)).toBe(4);
    expect(await waitingOf(world)).toBe(1);
    const fifth = (await rowsOf(world)).find(
      (row) => row.id === world.state.ports.childTurns[4]?.delegationId,
    );
    expect(fifth?.deadlineAt).toBe(
      world.state.world.clock.now() + AUTO_DELEGATION_DEADLINE_MINUTES * 60_000,
    );

    await endChild(world, 1);

    expect(world.state.ports.childTurns).toHaveLength(6);
    expect(await runningOf(world)).toBe(4);
    expect(await waitingOf(world)).toBe(0);
    expect(new Set(world.state.ports.childTurns.map((turn) => turn.delegationId)).size).toBe(6);
    expect(world.errors).toEqual([]);
  });

  it('stops the waiting children with the conversation, so none starts later', async () => {
    const world = await started();

    const outcome = await world.runtime.stop(world.treeId);
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(outcome).toEqual({ kind: 'stopped' });
    const rows = await rowsOf(world);
    expect(rows.every((row) => row.state === 'settled' && row.outcome === 'stopped')).toBe(true);
    expect(world.state.ports.childTurns).toHaveLength(4);
  });

  it('keeps the waiting children waiting once the spend limit is used up', async () => {
    const world = await started();
    await world.state.world.db.execute('UPDATE auto_trees SET cap_usd = 0.2 WHERE id = ?', [
      world.treeId,
    ]);

    await endChild(world, 0);

    expect(world.state.ports.childTurns).toHaveLength(4);
    expect(await runningOf(world)).toBe(3);
    expect(await waitingOf(world)).toBe(2);
  });

  it('starts the waiting children after a restart, each once, while a second window starts none', async () => {
    const world = await started();
    for (const [index, turn] of world.state.ports.childTurns.entries()) {
      if (index < 2) {
        world.state.ports.runOutcomes.set(turn.runId, {
          assistantText: done(String(turn.childAgentId)),
          exit: 'ok',
          costUsd: 0.2,
        });
        continue;
      }
      world.state.ports.liveRuns.add(turn.runId);
    }
    const before = new Set(world.state.ports.childTurns.map((turn) => turn.delegationId));

    const restarted = restartedWorld({ world });
    const second = restartedWorld({ world, isLeaseLapsed: false });
    await Promise.all([
      restarted.runtime.recover(world.treeId),
      second.runtime.recover(world.treeId),
    ]);
    await restarted.runtime.settled();
    await second.runtime.settled();

    const fresh = [...restarted.state.ports.childTurns, ...second.state.ports.childTurns];
    expect(fresh).toHaveLength(2);
    expect(fresh.every((turn) => !before.has(turn.delegationId))).toBe(true);
    expect(new Set(fresh.map((turn) => turn.delegationId)).size).toBe(2);
    expect(await waitingOf(world)).toBe(0);
    expect(await runningOf(world)).toBe(4);

    for (const turn of fresh) {
      world.state.ports.liveRuns.add(turn.runId);
    }
    const third = restartedWorld({ world });
    await third.runtime.recover(world.treeId);
    await third.runtime.settled();

    expect(third.state.ports.childTurns).toHaveLength(0);
    expect(await runningOf(world)).toBe(4);
  });
});
