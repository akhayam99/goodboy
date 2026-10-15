import { describe, expect, it } from 'vitest';
import { getAutoTree, listAutoOutbox, listAutoReservations } from '@goodboy/db';
import { deliverNext } from './deliver';
import { settleAutoTurn } from './settleAutoTurn';
import { batchInput, childInput, WORLD_TREE } from './testing/autoWorld';
import {
  addUserRow,
  endedTurn,
  makeDeliveryWorld,
  type DeliveryWorld,
} from './testing/deliveryWorld';

const startTurn = async (state: DeliveryWorld) => {
  await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'hello Auto' });
  await deliverNext({ ctx: state.ctx, treeId: WORLD_TREE, onEnded: state.onEnded });
  return state.ports.autoTurns[0]?.runId ?? '';
};

const settle = (state: DeliveryWorld, runId: string, overrides = {}) =>
  settleAutoTurn({ ctx: state.ctx, ended: endedTurn({ runId, ...overrides }) });

const tree = async (state: DeliveryWorld) =>
  getAutoTree({ db: state.world.db, treeId: WORLD_TREE });

describe('what happens when an Auto turn ends', () => {
  it('returns to answering after an answer when no work was ever handed over', async () => {
    const state = await makeDeliveryWorld();
    const runId = await startTurn(state);

    expect(await settle(state, runId)).toEqual({ kind: 'settled', phase: 'answering' });
    expect(await tree(state)).toMatchObject({
      phase: 'answering',
      activeRunId: null,
      activeDeliveryId: null,
      noProgressStreak: 0,
    });
    expect(await listAutoReservations({ db: state.world.db, treeId: WORLD_TREE })).toMatchObject([
      { ownerKind: 'auto_turn', state: 'reconciled', actualUsd: 0.1, isCostKnown: true },
    ]);
  });

  it('charges the reserved ceiling when the provider reported no cost', async () => {
    const state = await makeDeliveryWorld();
    const runId = await startTurn(state);

    await settle(state, runId, { costUsd: null });

    expect(await listAutoReservations({ db: state.world.db, treeId: WORLD_TREE })).toMatchObject([
      { state: 'reconciled', actualUsd: 0.5, isCostKnown: false },
    ]);
  });

  it('keeps the tree delegating after a turn that handed work over, and clears the run', async () => {
    const state = await makeDeliveryWorld();
    const runId = await startTurn(state);
    await state.world.scheduler.admit(batchInput({ runId, children: [childInput({ key: 'a' })] }));

    expect(await settle(state, runId, { assistantText: '' })).toEqual({
      kind: 'settled',
      phase: 'delegating',
    });
    expect(await tree(state)).toMatchObject({
      phase: 'delegating',
      isYieldRequested: true,
      activeRunId: null,
      noProgressStreak: 0,
    });
  });

  it('goes to waiting when agents are still open, to done when all settled, to merging when rows wait', async () => {
    const open = await makeDeliveryWorld();
    const openRun = await startTurn(open);
    await open.world.scheduler.admit(
      batchInput({ runId: openRun, children: [childInput({ key: 'a' })] }),
    );
    await open.world.db.execute(`UPDATE auto_trees SET is_yield_requested = 0, phase = 'deciding'`);
    expect(await settle(open, openRun)).toMatchObject({ phase: 'waiting' });

    const done = await makeDeliveryWorld();
    const doneRun = await startTurn(done);
    await done.world.scheduler.admit(
      batchInput({ runId: doneRun, children: [childInput({ key: 'a' })] }),
    );
    await done.world.db.execute(
      `UPDATE auto_delegations SET state = 'settled', outcome = 'completed', settled_at = 1`,
    );
    await done.world.db.execute(`UPDATE auto_trees SET is_yield_requested = 0, phase = 'deciding'`);
    expect(await settle(done, doneRun)).toMatchObject({ phase: 'done' });

    const queued = await makeDeliveryWorld();
    const queuedRun = await startTurn(queued);
    await addUserRow({ world: queued.world, id: 'outbox-user-2', text: 'one more thing' });
    expect(await settle(queued, queuedRun)).toMatchObject({ phase: 'merging' });
  });

  it('counts a turn with no answer and no work as no progress, and three in a row block delivery', async () => {
    const state = await makeDeliveryWorld();
    for (let index = 0; index < 3; index += 1) {
      await addUserRow({ world: state.world, id: `outbox-user-${index + 10}`, text: 'ping' });
      await deliverNext({ ctx: state.ctx, treeId: WORLD_TREE, onEnded: state.onEnded });
      const runId = state.ports.autoTurns[index]?.runId ?? '';
      await settleAutoTurn({
        ctx: state.ctx,
        ended: endedTurn({
          runId,
          deliveryId: state.ports.autoTurns[index]?.deliveryId ?? '',
          assistantText: '   ',
        }),
      });
    }
    expect((await tree(state))?.noProgressStreak).toBe(3);
    await addUserRow({ world: state.world, id: 'outbox-user-99', text: 'ping again' });

    const outcome = await deliverNext({
      ctx: state.ctx,
      treeId: WORLD_TREE,
      onEnded: state.onEnded,
    });

    expect(outcome).toMatchObject({ kind: 'blocked' });
    expect(state.ports.autoTurns).toHaveLength(3);
  });

  it('drops a late end of a run the tree has moved on from, but still pays for it', async () => {
    const state = await makeDeliveryWorld();
    const runId = await startTurn(state);
    await state.world.db.execute(`UPDATE auto_trees SET active_run_id = 'run-newer'`);

    expect(await settle(state, runId)).toEqual({ kind: 'dropped', reason: 'stale' });
    expect(await tree(state)).toMatchObject({ phase: 'deciding', activeRunId: 'run-newer' });
    expect(await listAutoReservations({ db: state.world.db, treeId: WORLD_TREE })).toMatchObject([
      { state: 'reconciled' },
    ]);
  });

  it('leaves a stopping tree to the stop flow', async () => {
    const state = await makeDeliveryWorld();
    const runId = await startTurn(state);
    await state.world.db.execute(`UPDATE auto_trees SET stop_state = 'requested'`);

    expect(await settle(state, runId)).toEqual({ kind: 'dropped', reason: 'stopping' });
  });

  it('puts the batch back for one more try when the turn failed, with a notice for Auto', async () => {
    const state = await makeDeliveryWorld();
    const runId = await startTurn(state);

    expect(await settle(state, runId, { exit: 'error', assistantText: 'half an ans' })).toEqual({
      kind: 'settled',
      phase: 'merging',
    });
    const pending = await listAutoOutbox({
      db: state.world.db,
      treeId: WORLD_TREE,
      states: ['pending'],
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]?.payload).toMatchObject({
      kind: 'user',
      text: 'hello Auto',
      restartOf: 'outbox-user-1',
    });
    expect(pending[0]?.id).not.toBe('outbox-user-1');
    expect((await tree(state))?.noProgressStreak).toBe(1);

    await deliverNext({ ctx: state.ctx, treeId: WORLD_TREE, onEnded: state.onEnded });
    expect(state.ports.autoTurns[1]?.text).toContain('Goodboy restarted while you were answering');
    expect(state.ports.autoTurns[1]?.deliveryId).toBe(pending[0]?.id);
  });

  it('settling twice changes nothing the second time', async () => {
    const state = await makeDeliveryWorld();
    const runId = await startTurn(state);
    await settle(state, runId);

    expect(await settle(state, runId)).toEqual({ kind: 'dropped', reason: 'stale' });
    expect((await tree(state))?.phase).toBe('answering');
  });
});
