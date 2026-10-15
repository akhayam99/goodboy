import { describe, expect, it } from 'vitest';
import { getAutoAttempt, listAutoDelegations, listAutoOutbox } from '@goodboy/db';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const ONE_WRITER = {
  children: [
    { role: 'implementer', task: 'add the export', reason: 'code', mount: 'mount-ledger-core' },
  ],
};

const started = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
  await autoDelegates({ world, spec: ONE_WRITER });
  await autoTurnEnds({ world });
  return world;
};

const pastDeadline = async (world: RuntimeWorld) => {
  world.state.world.clock.advance({ ms: 31 * 60_000 });
  await world.runtime.drive(world.treeId);
  await world.runtime.settled();
};

describe('a delegation past its deadline', () => {
  it('cancels the child, settles it timed out after the exit is confirmed and joins', async () => {
    const world = await started();

    await pastDeadline(world);

    expect(world.state.ports.cancels).toHaveLength(1);
    const [delegation] = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegation).toMatchObject({
      state: 'settled',
      outcome: 'timed_out',
      reason: 'deadline_passed',
    });
    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(world.state.ports.autoTurns[1]?.text).toContain(': timed_out, deadline_passed');
  });

  it('keeps it running and unjoined while the exit cannot be confirmed', async () => {
    const world = await started();
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }
    world.state.ports.setCancelOutcome({ outcome: 'still_running' }, turn.childAgentId);

    await pastDeadline(world);

    const [delegation] = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegation).toMatchObject({ state: 'running', isStopping: true });
    expect(world.state.ports.autoTurns).toHaveLength(1);
    expect(
      await getAutoAttempt({ db: world.state.world.db, attemptId: turn.attemptId }),
    ).toMatchObject({
      state: 'running',
    });

    world.state.ports.setCancelOutcome({ outcome: 'exited' }, turn.childAgentId);
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(
      (await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId }))[0],
    ).toMatchObject({
      state: 'settled',
      outcome: 'timed_out',
      isStopping: false,
    });
  });

  it('times out a child that is waiting for an answer without touching any process', async () => {
    const world = await started();
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }
    await childTurnEnds({
      world,
      index: 0,
      text: 'Need a choice.\n<<ctx-question blocking="true">>Which format?<</ctx-question>>',
    });
    await world.state.world.db.execute(
      `UPDATE auto_trees SET phase = 'waiting', active_run_id = NULL, active_delivery_id = NULL`,
    );
    await world.state.world.db.execute(
      `UPDATE auto_outbox SET state = 'pending' WHERE kind = 'question'`,
    );

    await pastDeadline(world);

    expect(world.state.ports.cancels).toHaveLength(0);
    const [delegation] = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegation).toMatchObject({ state: 'settled', outcome: 'timed_out' });
    const questions = (
      await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId })
    ).filter((row) => row.kind === 'question');
    expect(questions.map((row) => row.state)).toEqual(['dropped']);
  });
});
