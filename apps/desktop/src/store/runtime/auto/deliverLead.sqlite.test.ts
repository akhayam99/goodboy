import { describe, expect, it } from 'vitest';
import { joinDeliveryParts } from '@goodboy/core/auto';
import { getAutoTree, listAutoOutbox } from '@goodboy/db';
import { deliverNext } from './deliver';
import { settleAutoTurn } from './settleAutoTurn';
import { WORLD_TREE } from './testing/autoWorld';
import {
  addOutboxRow,
  addUserRow,
  endedTurn,
  makeDeliveryWorld,
  type DeliveryWorld,
} from './testing/deliveryWorld';

const deliver = (state: DeliveryWorld) =>
  deliverNext({ ctx: state.ctx, treeId: WORLD_TREE, onEnded: state.onEnded });

type ResultsRowParams = {
  readonly state: DeliveryWorld;
  readonly id: string;
  readonly batchId: string;
};

const addResultsRow = ({ state, id, batchId }: ResultsRowParams) =>
  addOutboxRow({
    world: state.world,
    id,
    kind: 'results',
    payload: { kind: 'results', batchId, results: [] },
  });

describe('the parts a delivery hands to the Lead turn', () => {
  it('join into its text, and a stored text sent again comes with no parts', async () => {
    const state = await makeDeliveryWorld();
    await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'hello' });
    state.ports.setAutoTurnOutcome({ kind: 'refused', message: 'offline' });
    await deliver(state);
    await state.world.db.execute(`UPDATE auto_trees SET phase = 'merging', blocked_reason = NULL`);
    state.ports.setAutoTurnOutcome(null);

    await deliver(state);

    const [first, again] = state.ports.autoTurns;
    expect(joinDeliveryParts({ parts: first?.parts ?? [] })).toBe(first?.text);
    expect(again?.text).toBe(first?.text);
    expect(again?.parts).toBeUndefined();
  });
});

describe('results that land while the Lead is answering', () => {
  it('reach the Lead together in its next turn', async () => {
    const state = await makeDeliveryWorld();
    await addUserRow({ world: state.world, id: 'outbox-user-1', text: 'split the export' });
    await deliver(state);
    const running = state.ports.autoTurns[0];
    await addResultsRow({ state, id: 'outbox-results-a', batchId: 'batch-a' });
    await addResultsRow({ state, id: 'outbox-results-b', batchId: 'batch-b' });

    expect(await deliver(state)).toMatchObject({ kind: 'idle', reason: 'no_rows' });
    await settleAutoTurn({
      ctx: state.ctx,
      ended: endedTurn({ runId: running?.runId ?? '', deliveryId: 'outbox-user-1' }),
    });
    expect((await getAutoTree({ db: state.world.db, treeId: WORLD_TREE }))?.phase).toBe('merging');
    await deliver(state);

    expect(state.ports.autoTurns).toHaveLength(2);
    const text = state.ports.autoTurns[1]?.text ?? '';
    expect(text).toContain('Results of batch batch-a:');
    expect(text).toContain('Results of batch batch-b:');
    expect(
      await listAutoOutbox({ db: state.world.db, treeId: WORLD_TREE, states: ['pending'] }),
    ).toEqual([]);
  });
});
