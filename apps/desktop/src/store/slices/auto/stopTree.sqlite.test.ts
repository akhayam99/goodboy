import { describe, expect, it } from 'vitest';
import {
  getAutoTree,
  listAutoAttemptsOfTree,
  listAutoDelegations,
  listAutoOutbox,
  listAutoReservations,
} from '@goodboy/db';
import { createAutoRuntime } from './createAutoRuntime';
import { stopTree } from './stopTree';
import { submitUserMessage } from './submitUserMessage';
import { secondScheduler } from './testing/autoWorld';
import { addOutboxRow } from './testing/deliveryWorld';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const THREE_WRITERS = {
  children: [
    { role: 'implementer', task: 'add the export', reason: 'code', mount: 'mount-ledger-core' },
    { role: 'tester', task: 'test the export', reason: 'tests', mount: 'mount-notify-relay' },
    { role: 'docs', task: 'document the export', reason: 'docs', mount: 'mount-notify-relay' },
  ],
};

const running = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
  await autoDelegates({ world, spec: THREE_WRITERS });
  await autoTurnEnds({ world });
  return world;
};

const stop = (world: RuntimeWorld) => stopTree({ ctx: world.state.ctx, treeId: world.treeId });

const treeOf = async (world: RuntimeWorld) =>
  getAutoTree({ db: world.state.world.db, treeId: world.treeId });

describe('stopping a tree', () => {
  it('cancels all three running children, confirms every exit and only then reports stopped', async () => {
    const world = await running();
    await addOutboxRow({
      world: world.state.world,
      id: 'outbox-late',
      kind: 'results',
      payload: { kind: 'results', batchId: 'batch-x', results: [] },
    });

    const outcome = await stop(world);

    expect(outcome).toEqual({ kind: 'stopped' });
    expect(world.state.ports.cancels).toHaveLength(3);
    expect(world.state.ports.revocations).toEqual([{ treeId: world.treeId }]);
    expect(await treeOf(world)).toMatchObject({
      phase: 'stopped',
      stopState: 'confirmed',
      generation: 2,
      activeRunId: null,
    });
    const attempts = await listAutoAttemptsOfTree({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(attempts.map((attempt) => [attempt.state, attempt.outcome])).toEqual([
      ['ended', 'stopped'],
      ['ended', 'stopped'],
      ['ended', 'stopped'],
    ]);
    const delegations = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegations.map((delegation) => [delegation.state, delegation.outcome])).toEqual([
      ['settled', 'stopped'],
      ['settled', 'stopped'],
      ['settled', 'stopped'],
    ]);
    const outbox = await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId });
    expect(outbox.find((row) => row.id === 'outbox-late')?.state).toBe('dropped');
    const reservations = await listAutoReservations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(reservations.some((reservation) => reservation.state === 'reserved')).toBe(false);
  });

  it('stays stopping when one cancel fails, keeps the others closed for later and retries', async () => {
    const world = await running();
    const [first] = await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });
    if (first === undefined) {
      throw new Error('a delegation was expected');
    }
    world.state.ports.setCancelOutcome({ outcome: 'still_running' }, first.childAgentId);

    const stuck = await stop(world);

    expect(stuck).toEqual({
      kind: 'stopping',
      stuck: [{ agentId: first.childAgentId, outcome: 'still_running' }],
    });
    expect(await treeOf(world)).toMatchObject({ phase: 'stopping', stopState: 'confirming' });
    const delegations = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegations.find((delegation) => delegation.id === first.id)).toMatchObject({
      state: 'running',
      isStopping: true,
    });
    expect(delegations.filter((delegation) => delegation.isStopping)).toHaveLength(1);

    world.state.ports.setCancelOutcome({ outcome: 'exited' }, first.childAgentId);
    expect(await stop(world)).toEqual({ kind: 'stopped' });
    expect((await treeOf(world))?.phase).toBe('stopped');
  });

  it('resumes after a restart that happened while it was confirming', async () => {
    const world = await running();
    const [first] = await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });
    if (first === undefined) {
      throw new Error('a delegation was expected');
    }
    world.state.ports.setCancelOutcome({ outcome: 'failed' }, first.childAgentId);
    await stop(world);
    world.state.ports.setCancelOutcome({ outcome: 'exited' }, first.childAgentId);
    world.state.world.clock.advance({ ms: 60_000 });
    const restarted = {
      ...world.state.ctx,
      scheduler: secondScheduler({ world: world.state.world }),
    };

    const outcome = await stopTree({ ctx: restarted, treeId: world.treeId });

    expect(outcome).toEqual({ kind: 'stopped' });
    expect((await treeOf(world))?.generation).toBe(2);
  });

  it('stops a tree whose children were never started and releases what they reserved', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
    await autoDelegates({ world, spec: THREE_WRITERS });

    const outcome = await stop(world);

    expect(outcome).toEqual({ kind: 'stopped' });
    const delegations = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegations.every((delegation) => delegation.outcome === 'stopped')).toBe(true);
    expect(world.state.ports.childTurns).toHaveLength(0);
    const reservations = await listAutoReservations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(reservations.some((reservation) => reservation.state === 'reserved')).toBe(false);
  });

  it('cancels the run of Auto itself when the stop comes mid turn', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });

    await stop(world);

    expect(world.state.ports.cancels.map((entry) => String(entry.agentId))).toEqual([
      'agent-auto-root',
    ]);
    expect((await treeOf(world))?.phase).toBe('stopped');
  });

  it('drops a child result and an Auto turn end that arrive after the stop', async () => {
    const world = await running();
    await stop(world);

    await childTurnEnds({
      world,
      index: 0,
      text: `late\n<<step-done id="${world.state.ports.childTurns[0]?.childAgentId}">>`,
    });

    expect(world.state.ports.autoTurns).toHaveLength(1);
    const attempts = await listAutoAttemptsOfTree({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(attempts.every((attempt) => attempt.outcome === 'stopped')).toBe(true);
  });

  it('starts nothing after the stop even if a launch was already underway', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
    await autoDelegates({ world, spec: THREE_WRITERS });
    await stop(world);

    await autoTurnEnds({ world });

    expect(world.state.ports.childTurns).toHaveLength(0);
    expect((await treeOf(world))?.phase).toBe('stopped');
  });

  it('starts a new conversation turn from the next message and never resumes the stopped work', async () => {
    const world = await running();
    await stop(world);

    const queued = await submitUserMessage({
      ctx: world.state.ctx,
      treeId: world.treeId,
      text: 'start over with the notify-relay change',
    });
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(queued.kind).toBe('queued');
    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(world.state.ports.autoTurns[1]?.generation).toBe(2);
    expect(world.state.ports.autoTurns[1]?.text).toContain(
      'start over with the notify-relay change',
    );
    expect(world.state.ports.autoTurns[1]?.text).not.toContain('RESULTS FROM YOUR AGENTS');
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding', stopState: 'none' });
    expect(world.state.ports.childTurns).toHaveLength(3);
  });

  it('is a no-op on a tree that is already stopped', async () => {
    const world = await running();
    await stop(world);

    expect(await stop(world)).toEqual({ kind: 'idle', reason: 'already_stopped' });
    expect(world.state.ports.cancels).toHaveLength(3);
  });

  it('lets only the window that owns the tree stop it', async () => {
    const world = await running();
    const other = createAutoRuntime({
      ctx: { ...world.state.ctx, scheduler: secondScheduler({ world: world.state.world }) },
      isEnabled: true,
      onError: () => undefined,
    });

    const outcome = await stopTree({ ctx: other.ctx, treeId: world.treeId });

    expect(outcome).toEqual({ kind: 'idle', reason: 'not_owner' });
    expect((await treeOf(world))?.stopState).toBe('none');
  });
});
