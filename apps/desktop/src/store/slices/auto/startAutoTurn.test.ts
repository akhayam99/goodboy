import { describe, expect, it, vi } from 'vitest';
import { AUTO_SEED_ROOT, AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type ProviderRunId } from '@goodboy/types';
import type { SendTurnInput, SendTurnResult } from '../turn/types';
import type { AutoTurnEnded, DeliveryRun, StartAutoTurnParams } from './ports';
import { makeStartAutoTurn } from './startAutoTurn';
import { WORLD_TREE } from './testing/autoWorld';

type Script = Readonly<{
  send: (input: SendTurnInput) => Promise<SendTurnResult>;
  lookups: ReadonlyArray<DeliveryRun | null>;
}>;

type Harness = Readonly<{
  start: (params: StartAutoTurnParams) => ReturnType<ReturnType<typeof makeStartAutoTurn>>;
  inputs: Array<SendTurnInput>;
  ended: Array<AutoTurnEnded>;
  params: StartAutoTurnParams;
}>;

const harness = ({ send, lookups }: Script): Harness => {
  const inputs: Array<SendTurnInput> = [];
  const ended: Array<AutoTurnEnded> = [];
  let poll = 0;
  const start = makeStartAutoTurn({
    sendTurn: (input) => {
      inputs.push(input);
      return send(input);
    },
    lookupDeliveryRun: async () => {
      const found = lookups[Math.min(poll, lookups.length - 1)] ?? null;
      poll += 1;
      return found;
    },
    readRunCostUsd: async () => 0.25,
    sleep: async () => undefined,
    nowMs: () => 0,
  });
  return {
    start,
    inputs,
    ended,
    params: {
      treeId: WORLD_TREE,
      agentId: AUTO_SEED_ROOT,
      sessionId: AUTO_SEED_SESSION,
      generation: 2,
      runId: 'run-planned',
      deliveryId: 'outbox-1',
      text: 'hello',
      onEnded: (event) => {
        ended.push(event);
      },
    },
  };
};

const NOT_BLOCKED: SendTurnResult = { blockedOverBudget: false };

describe('starting the turn of Auto through the store', () => {
  it('sends a delegation turn that carries its run, delivery and tree, and reports the end once', async () => {
    const state = harness({
      lookups: [null, null, { runId: 'run-planned', isLive: true }],
      send: async (input) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        input.onSettled?.({
          runId: brandId<ProviderRunId>({ value: 'run-planned' }),
          assistantText: 'All done.',
          hasFailed: false,
          wasCancelled: false,
          filesTouched: [],
        });
        return NOT_BLOCKED;
      },
    });

    const outcome = await state.start(state.params);
    await vi.waitFor(() => expect(state.ended).toHaveLength(1));

    expect(outcome).toEqual({ kind: 'started', runId: 'run-planned' });
    expect(state.inputs[0]).toMatchObject({
      origin: 'delegation',
      confinedRole: 'auto',
      runId: 'run-planned',
      deliveryId: 'outbox-1',
      autoTree: { treeId: 'tree-1', generation: 2 },
      content: 'hello',
    });
    expect(state.ended[0]).toMatchObject({
      assistantText: 'All done.',
      exit: 'ok',
      costUsd: 0.25,
      deliveryId: 'outbox-1',
    });
  });

  it('reports a cancelled turn and a failed one with their exit', async () => {
    for (const [settled, exit] of [
      [{ hasFailed: false, wasCancelled: true }, 'cancelled'],
      [{ hasFailed: true, wasCancelled: false }, 'error'],
    ] as const) {
      const state = harness({
        lookups: [{ runId: 'run-planned', isLive: true }],
        send: async (input) => {
          input.onSettled?.({
            runId: brandId<ProviderRunId>({ value: 'run-planned' }),
            assistantText: 'part',
            filesTouched: [],
            ...settled,
          });
          return NOT_BLOCKED;
        },
      });
      await state.start(state.params);
      await vi.waitFor(() => expect(state.ended).toHaveLength(1));
      expect(state.ended[0]?.exit).toBe(exit);
    }
  });

  it('reports the end of a turn that threw after it started', async () => {
    const state = harness({
      lookups: [{ runId: 'run-planned', isLive: true }],
      send: async () => {
        throw new Error('the provider crashed');
      },
    });

    await state.start(state.params);
    await vi.waitFor(() => expect(state.ended).toHaveLength(1));

    expect(state.ended[0]).toMatchObject({ exit: 'error', assistantText: '' });
  });

  it('refuses when sending fails before the registry knows the delivery, and reports no end', async () => {
    const state = harness({
      lookups: [null],
      send: async () => {
        throw new Error('Claude is not signed in');
      },
    });

    const outcome = await state.start(state.params);

    expect(outcome).toEqual({ kind: 'refused', message: expect.stringContaining('not signed in') });
    expect(state.ended).toHaveLength(0);
  });

  it('refuses a turn blocked by the budget', async () => {
    const state = harness({ lookups: [null], send: async () => ({ blockedOverBudget: true }) });

    const outcome = await state.start(state.params);

    expect(outcome).toMatchObject({ kind: 'refused', message: expect.stringContaining('budget') });
  });

  it('answers duplicate when the registry holds another run for the delivery, and watches nothing', async () => {
    const state = harness({
      lookups: [{ runId: 'run-before-the-crash', isLive: true }],
      send: async () => {
        throw new Error('this delivery already started run run-before-the-crash');
      },
    });

    const outcome = await state.start(state.params);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(outcome).toEqual({ kind: 'duplicate', runId: 'run-before-the-crash' });
    expect(state.ended).toHaveLength(0);
  });

  it('gives up when the turn never shows up in the registry', async () => {
    const state = harness({ lookups: [null], send: () => new Promise(() => undefined) });

    const outcome = await state.start(state.params);

    expect(outcome).toEqual({ kind: 'refused', message: 'The turn did not start in time.' });
  });
});
