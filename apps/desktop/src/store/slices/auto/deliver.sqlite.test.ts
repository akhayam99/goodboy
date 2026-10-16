import { describe, expect, it } from 'vitest';
import { getAutoOutbox, getAutoTree, listAutoOutbox, listAutoReservations } from '@goodboy/db';
import { AUTO_TURN_CEILING_USD } from '@goodboy/core';
import { brandId, type AutoOutboxId, type SessionId } from '@goodboy/types';
import { readAutoTreeViews } from '../auto-view/readAutoTreeViews';
import { deliverNext } from './deliver';
import { secondScheduler, WORLD_TREE } from './testing/autoWorld';
import {
  addOutboxRow,
  addQuestionRow,
  addUserRow,
  makeDeliveryWorld,
  type DeliveryWorld,
} from './testing/deliveryWorld';

const outboxId = (value: string) => brandId<AutoOutboxId>({ value });

const deliver = (state: DeliveryWorld) =>
  deliverNext({ ctx: state.ctx, treeId: WORLD_TREE, onEnded: state.onEnded });

const phaseOf = async (state: DeliveryWorld) =>
  (await getAutoTree({ db: state.world.db, treeId: WORLD_TREE }))?.phase;

describe('the budget line of a delivery', () => {
  it('says the Left the rail reads while that turn runs, its own reservation included', async () => {
    const state = await makeDeliveryWorld();
    await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'hello' });

    await deliver(state);

    const text = state.ports.autoTurns[0]?.text ?? '';
    const views = await readAutoTreeViews({
      db: state.world.db,
      sessionId: brandId<SessionId>({ value: 'session-harborline' }),
    });
    const budget = views[0]?.budget;
    expect(budget?.reservedUsd).toBe(AUTO_TURN_CEILING_USD);
    expect(text).toContain(`Left ${budget?.remainingUsd.toFixed(2)} USD.`);
    expect(text).toContain(
      `Reserved ${budget?.reservedUsd.toFixed(2)} USD, of which ${AUTO_TURN_CEILING_USD.toFixed(2)} USD for this answer.`,
    );
  });
});

describe('delivering stored rows to Auto', () => {
  it('claims the row, makes the tree deciding on the planned run and accepts it once the turn started', async () => {
    const state = await makeDeliveryWorld();
    await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'add the ledger export' });

    const outcome = await deliver(state);

    expect(outcome).toMatchObject({ kind: 'delivered', deliveryId: 'outbox-user-1' });
    expect(state.ports.autoTurns).toHaveLength(1);
    expect(state.ports.autoTurns[0]).toMatchObject({
      deliveryId: 'outbox-user-1',
      generation: 1,
      sessionId: 'session-harborline',
    });
    expect(state.ports.autoTurns[0]?.text).toContain('add the ledger export');
    expect(state.ports.autoTurns[0]?.text).toContain('Artifacts in this tree');
    expect(state.ports.autoTurns[0]?.text).toContain('Budget for this conversation');
    expect(state.ports.autoTurns[0]?.text).toContain(
      'MOUNTS: mount-ledger-core (ledger-core, branch ak/ledger-export); mount-notify-relay (notify-relay, branch ak/notify-queue).',
    );
    expect(await getAutoTree({ db: state.world.db, treeId: WORLD_TREE })).toMatchObject({
      phase: 'deciding',
      activeRunId: state.ports.autoTurns[0]?.runId,
      activeDeliveryId: 'outbox-user-1',
      turnsUsed: 1,
      isYieldRequested: false,
    });
    expect(
      await getAutoOutbox({ db: state.world.db, outboxId: outboxId('outbox-user-1') }),
    ).toMatchObject({
      state: 'accepted',
      acceptedRunId: state.ports.autoTurns[0]?.runId,
    });
    expect(await listAutoReservations({ db: state.world.db, treeId: WORLD_TREE })).toMatchObject([
      { ownerKind: 'auto_turn', ownerId: 'outbox-user-1', reservedUsd: 0.5, state: 'reserved' },
    ]);
  });

  it('keeps a user message waiting while children run and delivers a question at once', async () => {
    const state = await makeDeliveryWorld();
    await state.world.db.execute(`UPDATE auto_trees SET phase = 'waiting'`);
    await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'also add tests' });

    expect(await deliver(state)).toMatchObject({ kind: 'idle', reason: 'no_rows' });
    expect(state.ports.autoTurns).toHaveLength(0);

    await addQuestionRow({ world: state.world, id: 'outbox-question-1' });
    const outcome = await deliver(state);

    expect(outcome).toMatchObject({ kind: 'delivered', deliveryId: 'outbox-question-1' });
    expect(state.ports.autoTurns[0]?.text).toContain('QUESTIONS FROM YOUR AGENTS');
    expect(state.ports.autoTurns[0]?.text).not.toContain('also add tests');
    expect(
      (await listAutoOutbox({ db: state.world.db, treeId: WORLD_TREE, states: ['pending'] })).map(
        (row) => row.id,
      ),
    ).toEqual(['outbox-user-1']);
  });

  it('delivers the results and the pending user messages as one turn, in order', async () => {
    const state = await makeDeliveryWorld();
    await state.world.db.execute(`UPDATE auto_trees SET phase = 'merging'`);
    await addUserRow({ world: state.world, id: 'outbox-user-2', text: 'second message', atMs: 20 });
    await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'first message', atMs: 10 });
    await addOutboxRow({
      world: state.world,
      id: 'outbox-results-1',
      kind: 'results',
      payload: { kind: 'results', batchId: 'batch-1', results: [] },
      atMs: 30,
    });

    const outcome = await deliver(state);

    expect(outcome).toMatchObject({ kind: 'delivered', deliveryId: 'outbox-results-1' });
    expect(state.ports.autoTurns).toHaveLength(1);
    const text = state.ports.autoTurns[0]?.text ?? '';
    expect(text.indexOf('RESULTS FROM YOUR AGENTS')).toBeLessThan(text.indexOf('first message'));
    expect(text.indexOf('first message')).toBeLessThan(text.indexOf('second message'));
    const rows = await listAutoOutbox({ db: state.world.db, treeId: WORLD_TREE });
    expect(rows.map((row) => row.state)).toEqual(['accepted', 'accepted', 'accepted']);
  });

  it('rolls everything back when the provider refuses to start, and shows why', async () => {
    const state = await makeDeliveryWorld();
    await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'hello' });
    state.ports.setAutoTurnOutcome({ kind: 'refused', message: 'Claude is not signed in' });

    const outcome = await deliver(state);

    expect(outcome).toMatchObject({ kind: 'blocked', reason: 'Claude is not signed in' });
    expect(await getAutoTree({ db: state.world.db, treeId: WORLD_TREE })).toMatchObject({
      phase: 'blocked',
      blockedReason: 'Claude is not signed in',
      activeRunId: null,
      activeDeliveryId: null,
      turnsUsed: 0,
    });
    expect(
      await getAutoOutbox({ db: state.world.db, outboxId: outboxId('outbox-user-1') }),
    ).toMatchObject({
      state: 'pending',
      claimedBy: null,
    });
    expect(await listAutoReservations({ db: state.world.db, treeId: WORLD_TREE })).toMatchObject([
      { state: 'released', releasedReason: 'delivery_failed' },
    ]);
  });

  it('treats a start that throws like a refusal', async () => {
    const state = await makeDeliveryWorld();
    await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'hello' });
    state.ports.setAutoTurnFailure(new Error('the provider process did not start'));

    const outcome = await deliver(state);

    expect(outcome).toMatchObject({ kind: 'blocked' });
    expect(await phaseOf(state)).toBe('blocked');
  });

  it('sends the very same text again after a failed start', async () => {
    const state = await makeDeliveryWorld();
    await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'hello' });
    state.ports.setAutoTurnOutcome({ kind: 'refused', message: 'offline' });
    await deliver(state);
    state.world.clock.advance({ ms: 5 * 60_000 });
    await state.world.db.execute(`UPDATE auto_trees SET phase = 'merging', blocked_reason = NULL`);
    state.ports.setAutoTurnOutcome(null);

    await deliver(state);

    expect(state.ports.autoTurns).toHaveLength(2);
    expect(state.ports.autoTurns[1]?.text).toBe(state.ports.autoTurns[0]?.text);
  });

  it('commits the acceptance on the run the registry already holds for the delivery', async () => {
    const state = await makeDeliveryWorld();
    await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'hello' });
    state.ports.setAutoTurnOutcome({ kind: 'duplicate', runId: 'run-from-before-the-crash' });

    const outcome = await deliver(state);

    expect(outcome).toMatchObject({ kind: 'delivered', runId: 'run-from-before-the-crash' });
    expect(await getAutoTree({ db: state.world.db, treeId: WORLD_TREE })).toMatchObject({
      activeRunId: 'run-from-before-the-crash',
    });
    expect(
      await getAutoOutbox({ db: state.world.db, outboxId: outboxId('outbox-user-1') }),
    ).toMatchObject({
      state: 'accepted',
      acceptedRunId: 'run-from-before-the-crash',
    });
  });

  it('lets only the window that owns the tree deliver, so one row starts one turn', async () => {
    const state = await makeDeliveryWorld();
    await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'hello' });
    const other = secondScheduler({ world: state.world });

    const lost = await deliverNext({
      ctx: { ...state.ctx, scheduler: other },
      treeId: WORLD_TREE,
      onEnded: state.onEnded,
    });
    const won = await deliver(state);

    expect(lost).toMatchObject({ kind: 'idle', reason: 'not_owner' });
    expect(won.kind).toBe('delivered');
    expect(state.ports.autoTurns).toHaveLength(1);
  });

  it('blocks the tree when the lifetime turn limit or the budget leaves no room', async () => {
    const turns = await makeDeliveryWorld();
    await addUserRow({ world: turns.world, id: 'outbox-user-1', text: 'hello' });
    await turns.world.db.execute(`UPDATE auto_trees SET turns_used = 30`);
    expect(await deliver(turns)).toMatchObject({ kind: 'blocked' });
    expect(await getAutoTree({ db: turns.world.db, treeId: WORLD_TREE })).toMatchObject({
      phase: 'blocked',
      blockedReason: expect.stringContaining('turns'),
    });
    expect(turns.ports.autoTurns).toHaveLength(0);

    const budget = await makeDeliveryWorld({ capUsd: 0.2 });
    await addUserRow({ world: budget.world, id: 'outbox-user-1', text: 'hello' });
    expect(await deliver(budget)).toMatchObject({ kind: 'blocked' });
    expect(budget.ports.autoTurns).toHaveLength(0);
  });

  it('never delivers a row of an older generation or into a stopped tree', async () => {
    const state = await makeDeliveryWorld();
    await addOutboxRow({
      world: state.world,
      id: 'outbox-old',
      kind: 'user',
      payload: { kind: 'user', text: 'old', facts: {} },
      generation: 2,
    });
    expect(await deliver(state)).toMatchObject({ kind: 'idle', reason: 'no_rows' });
    await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'hello' });
    await state.world.db.execute(`UPDATE auto_trees SET stop_state = 'requested'`);
    expect(await deliver(state)).toMatchObject({ kind: 'idle', reason: 'stopped' });
    expect(state.ports.autoTurns).toHaveLength(0);
  });

  it('does not deliver while a turn is already running', async () => {
    const state = await makeDeliveryWorld();
    await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'hello' });
    await deliver(state);
    await addUserRow({ world: state.world, id: 'outbox-user-2', text: 'and another' });

    expect(await deliver(state)).toMatchObject({ kind: 'idle', reason: 'no_rows' });
    expect(state.ports.autoTurns).toHaveLength(1);
  });
});
