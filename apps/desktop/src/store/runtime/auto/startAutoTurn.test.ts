import { describe, expect, it, vi } from 'vitest';
import { AUTO_SEED_ROOT, AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type ProviderRunId } from '@goodboy/types';
import type { SendTurnInput, SendTurnResult } from '../../slices/turn/types';
import type { AutoTurnEnded, DeliveryRun, StartAutoTurnParams } from './ports';
import { makeStartAutoTurn, type StartAutoTurnDeps } from './startAutoTurn';
import { WORLD_TREE } from './testing/autoWorld';

type Script = Readonly<{
  send: (input: SendTurnInput) => Promise<SendTurnResult>;
  lookups: ReadonlyArray<DeliveryRun | null>;
  loadPicks?: StartAutoTurnDeps['loadAgentPicks'];
}>;

type Harness = Readonly<{
  start: (params: StartAutoTurnParams) => ReturnType<ReturnType<typeof makeStartAutoTurn>>;
  inputs: Array<SendTurnInput>;
  ended: Array<AutoTurnEnded>;
  params: StartAutoTurnParams;
}>;

const START_DEADLINE_MS = 20_000;

const harness = ({ send, lookups, loadPicks = async () => undefined }: Script): Harness => {
  const inputs: Array<SendTurnInput> = [];
  const ended: Array<AutoTurnEnded> = [];
  let poll = 0;
  const start = makeStartAutoTurn({
    loadAgentPicks: loadPicks,
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
  it('hands the read grant to the turn, which reads no answers again', async () => {
    const state = harness({
      lookups: [{ runId: 'run-planned', isLive: true }],
      send: async () => NOT_BLOCKED,
    });

    await state.start({
      ...state.params,
      permissionOnceAllows: ['Read(//notify-relay/README.md)'],
    });

    expect(state.inputs[0]).toMatchObject({
      permissionOnceAllows: ['Read(//notify-relay/README.md)'],
      resolvedAsks: { denied: [], held: [] },
    });
  });

  it('hands the parts of the delivery to the turn, so a resumed Lead gets only what changed', async () => {
    const state = harness({
      lookups: [{ runId: 'run-planned', isLive: true }],
      send: async () => NOT_BLOCKED,
    });
    const parts = [{ name: 'user', kind: 'news', text: 'hello' }] as const;

    await state.start({ ...state.params, parts });

    expect(state.inputs[0]?.leadDelivery).toEqual(parts);
  });

  it('reads the agent picks of the session before it sends the turn', async () => {
    const steps: Array<string> = [];
    const state = harness({
      lookups: [{ runId: 'run-planned', isLive: true }],
      loadPicks: async ({ sessionId }) => {
        await Promise.resolve();
        steps.push(`read ${sessionId}`);
      },
      send: async () => {
        steps.push('send');
        return NOT_BLOCKED;
      },
    });

    await state.start(state.params);

    expect(steps).toEqual([`read ${AUTO_SEED_SESSION}`, 'send']);
  });

  it('sends no turn and reports no end when the agent picks cannot be read', async () => {
    const state = harness({
      lookups: [null],
      loadPicks: async () => {
        throw new Error('database is locked');
      },
      send: async () => NOT_BLOCKED,
    });

    await expect(state.start(state.params)).rejects.toThrow('database is locked');
    expect(state.inputs).toHaveLength(0);
    expect(state.ended).toHaveLength(0);
  });

  it('refuses the turn when the agent picks are not read before the start deadline, and a late read sends nothing', async () => {
    let finishRead: () => void = () => undefined;
    const state = harness({
      lookups: [{ runId: 'run-planned', isLive: true }],
      loadPicks: () =>
        new Promise<void>((resolve) => {
          finishRead = resolve;
        }),
      send: async () => NOT_BLOCKED,
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const started = state.start(state.params);
    await vi.advanceTimersByTimeAsync(START_DEADLINE_MS);
    const outcome = await started;
    vi.useRealTimers();
    finishRead();
    await Promise.resolve();

    expect(outcome).toEqual({ kind: 'refused', message: 'The turn did not start in time.' });
    expect(state.inputs).toHaveLength(0);
    expect(state.ended).toHaveLength(0);
  });

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

  it('refuses a turn when every provider is over its limit', async () => {
    const state = harness({ lookups: [null], send: async () => ({ blockedOverBudget: true }) });

    const outcome = await state.start(state.params);

    expect(outcome).toMatchObject({
      kind: 'refused',
      message: expect.stringContaining('over its limit'),
    });
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

  it('hands the outbox rows it delivers to the turn, so the transcript can place each message', async () => {
    const state = harness({
      lookups: [{ runId: 'run-planned', isLive: true }],
      send: async () => NOT_BLOCKED,
    });

    await state.start({ ...state.params, rowIds: ['outbox-1', 'outbox-2'] });

    expect(state.inputs[0]).toMatchObject({ outboxIds: ['outbox-1', 'outbox-2'] });
  });

  it('gives up when the turn never shows up in the registry', async () => {
    const state = harness({ lookups: [null], send: () => new Promise(() => undefined) });

    const outcome = await state.start(state.params);

    expect(outcome).toEqual({ kind: 'refused', message: 'The turn did not start in time.' });
  });
});
