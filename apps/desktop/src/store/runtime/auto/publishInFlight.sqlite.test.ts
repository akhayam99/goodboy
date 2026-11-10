import { afterEach, describe, expect, it, vi } from 'vitest';
import { publishRowsOf } from '../../../features/auto/chat/publishRowsOf';
import { PUSH_LIVE_WINDOW_MS } from './settledPush/PUSH_LIVE_WINDOW_MS';
import { PUSH_SWEEP_RETRY_MS } from './settledPush/PUSH_SWEEP_RETRY_MS';
import { createPushSweep } from './settledPush/createPushSweep';
import { sweepStalePushing } from './settledPush/sweepStalePushing';
import { publishAct } from './publishAct';
import {
  attemptPublishOf,
  delegationsOf,
  holdPushes,
  idsOf,
  LEDGER_FORCE,
  LEDGER_PUSH,
  leavePushing,
  recordOf,
  settle,
} from './testing/publishWorld';
import { restartedWorld, type RuntimeWorld } from './testing/runtimeWorld';
import type { AgentVerbContext } from './verbContext';

const NOTIFY_FORCE = { publish: 'force', mount: 'mount-notify-relay' };

type BeforeWriteParams = {
  readonly ctx: AgentVerbContext;
  readonly beforeWrite: (params: { readonly call: number }) => Promise<void>;
};

const withWriteHook = ({ ctx, beforeWrite }: BeforeWriteParams): AgentVerbContext => {
  let call = 0;
  const db = Object.create(ctx.db);
  db.transaction = async (params: Parameters<typeof ctx.db.transaction>[0]) => {
    call += 1;
    await beforeWrite({ call });
    return ctx.db.transaction(params);
  };
  return { ...ctx, db };
};

const DB_BUSY = 'database is busy';

const NETWORK_STEPS_MS = 3 * 30 * 60 * 1000;

const SETTLE_LATER_FIRST_MS = 2_000;
const SETTLE_LATER_SECOND_MS = 10_000;

const failWritesFrom =
  ({ from, until }: { readonly from: number; readonly until: number }) =>
  async ({ call }: { readonly call: number }): Promise<void> => {
    if (call >= from && call <= until) {
      throw new Error(DB_BUSY);
    }
  };

type WorldParams = {
  readonly world: RuntimeWorld;
};

const nowOf = ({ world }: WorldParams): number => world.state.world.clock.now();

describe('a push in flight survives a reload', () => {
  it('saves pushing before the push runs and the result after, where a reload reads it', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    const held = holdPushes({ world });

    const answered = world.runtime.publish({ act: 'confirm', delegationIds: await idsOf(world) });
    await vi.waitFor(async () =>
      expect(await recordOf(world)).toMatchObject({
        state: 'pushing',
        isConfirmed: true,
        isRetryable: false,
        message: null,
        startedAt: nowOf({ world }),
      }),
    );
    expect(world.state.ports.pushes).toEqual([]);
    expect(await attemptPublishOf(world)).toMatchObject({ state: 'pushing', isConfirmed: true });

    const reloaded = restartedWorld({ world, isLeaseLapsed: false });
    expect(await recordOf(reloaded)).toMatchObject({ state: 'pushing', isConfirmed: true });

    held.open();
    const result = await answered;
    expect(result.rows[0]).toMatchObject({ state: 'pushed' });
    expect(await recordOf(reloaded)).toMatchObject({ state: 'pushed' });
    expect(await attemptPublishOf(reloaded)).toMatchObject({ state: 'pushed' });
  });

  it('pushes once when a second answer comes during the push', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    const delegationIds = await idsOf(world);
    const held = holdPushes({ world });

    const first = world.runtime.publish({ act: 'confirm', delegationIds });
    await vi.waitFor(async () => expect(await recordOf(world)).toMatchObject({ state: 'pushing' }));
    const second = world.runtime.publish({ act: 'confirm', delegationIds });
    held.open();

    expect((await first).rows[0]?.state).toBe('pushed');
    expect((await second).rows[0]?.state).toBe('refused');
    expect(world.state.ports.pushes).toHaveLength(1);
  });

  it('pushes once when a second window confirms between the first one reading and saving', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    const delegationIds = await idsOf(world);
    const other = withWriteHook({
      ctx: world.state.ctx,
      beforeWrite: async ({ call }) => {
        if (call === 1) {
          await leavePushing({ world, startedAt: nowOf({ world }) });
        }
      },
    });

    const result = await publishAct({ ctx: other, act: 'confirm', delegationIds });

    expect(result.rows[0]).toMatchObject({
      state: 'refused',
      message: 'The push was not saved on the card because the result moved on.',
    });
    expect(world.state.ports.pushes).toEqual([]);
    expect(await recordOf(world)).toMatchObject({ state: 'pushing', isConfirmed: true });
    expect(await attemptPublishOf(world)).toMatchObject({ state: 'pushing' });
  });

  it('refuses every answer for a push already under way and pushes nothing', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    await leavePushing({ world });

    for (const act of ['confirm', 'decline', 'retry', 'put_back'] as const) {
      const result = await world.runtime.publish({ act, delegationIds: await idsOf(world) });
      expect(result.rows[0]).toMatchObject({
        state: 'refused',
        message: 'This push is already under way.',
      });
    }
    expect(world.state.ports.pushes).toEqual([]);
    expect(await recordOf(world)).toMatchObject({ state: 'pushing' });
  });
});

describe('a push whose result could not be saved', () => {
  it('saves the result on the second try when the first write fails', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    const flaky = withWriteHook({
      ctx: world.state.ctx,
      beforeWrite: failWritesFrom({ from: 2, until: 2 }),
    });

    const result = await publishAct({
      ctx: flaky,
      act: 'confirm',
      delegationIds: await idsOf(world),
    });

    expect(result.rows[0]).toMatchObject({ state: 'pushed' });
    expect(world.state.ports.pushes).toHaveLength(1);
    expect(await recordOf(world)).toMatchObject({ state: 'pushed' });
    expect(await attemptPublishOf(world)).toMatchObject({ state: 'pushed' });
  });

  it('leaves a retryable failure, not a push stuck pushing, when both writes fail', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    const failing = withWriteHook({
      ctx: world.state.ctx,
      beforeWrite: failWritesFrom({ from: 2, until: 3 }),
    });

    const result = await publishAct({
      ctx: failing,
      act: 'confirm',
      delegationIds: await idsOf(world),
    });

    const expected = {
      state: 'failed',
      isRetryable: true,
      isConfirmed: false,
      tries: 0,
      message: expect.stringContaining('its result was not saved'),
    };
    expect(result.rows[0]).toMatchObject({ state: 'failed' });
    expect(world.state.ports.pushes).toHaveLength(1);
    expect(await recordOf(world)).toMatchObject(expected);
    expect(await attemptPublishOf(world)).toMatchObject(expected);
    const rows = publishRowsOf({ delegations: await delegationsOf(world) });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.line).toMatchObject({ state: 'failed', canRetry: true });
  });
});

describe('a push whose result could not be saved at all', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports the storage failure and saves the real result once storage recovers', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const world = await settle({ publishes: [LEDGER_FORCE] });
    const failing = withWriteHook({
      ctx: world.state.ctx,
      beforeWrite: failWritesFrom({ from: 2, until: 4 }),
    });

    const result = await publishAct({
      ctx: failing,
      act: 'confirm',
      delegationIds: await idsOf(world),
    });

    expect(result.rows[0]).toMatchObject({ state: 'refused', isStorageFailure: true });
    expect(world.state.ports.pushes).toHaveLength(1);
    expect(await recordOf(world)).toMatchObject({ state: 'pushing' });

    await vi.advanceTimersByTimeAsync(SETTLE_LATER_FIRST_MS);

    expect(await recordOf(world)).toMatchObject({ state: 'pushed', isConfirmed: true });
    expect(await attemptPublishOf(world)).toMatchObject({ state: 'pushed' });
  });

  it('keeps trying while storage stays down and stops once a newer state is saved', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const world = await settle({ publishes: [LEDGER_FORCE] });
    const failing = withWriteHook({
      ctx: world.state.ctx,
      beforeWrite: failWritesFrom({ from: 2, until: 5 }),
    });

    await publishAct({ ctx: failing, act: 'confirm', delegationIds: await idsOf(world) });
    await vi.advanceTimersByTimeAsync(SETTLE_LATER_FIRST_MS);
    expect(await recordOf(world)).toMatchObject({ state: 'pushing' });

    await vi.advanceTimersByTimeAsync(SETTLE_LATER_SECOND_MS);
    expect(await recordOf(world)).toMatchObject({ state: 'pushed' });
  });

  it('does not overwrite a record that moved on while the save waited', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const world = await settle({ publishes: [LEDGER_FORCE] });
    const failing = withWriteHook({
      ctx: world.state.ctx,
      beforeWrite: failWritesFrom({ from: 2, until: 4 }),
    });

    await publishAct({ ctx: failing, act: 'confirm', delegationIds: await idsOf(world) });
    const restarted = restartedWorld({ world });
    world.state.world.clock.advance({ ms: PUSH_LIVE_WINDOW_MS + 1 });
    await sweepStalePushing({ ctx: restarted.state.ctx });
    await vi.advanceTimersByTimeAsync(SETTLE_LATER_FIRST_MS);

    expect(await recordOf(world)).toMatchObject({ state: 'failed', isRetryable: true });
  });
});

describe('the boot sweep of a push left pushing', () => {
  it('turns a push left pushing by a crash into a failure the user can retry, on boot', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    await leavePushing({ world });
    const restarted = restartedWorld({ world });

    const swept = await sweepStalePushing({ ctx: restarted.state.ctx });

    expect(swept).toMatchObject({ swept: 1, live: 0, failed: [] });
    expect(restarted.state.ports.pushes).toEqual([]);
    const expected = {
      state: 'failed',
      isRetryable: true,
      isConfirmed: false,
      message: expect.stringContaining('Goodboy closed while it was pushing'),
    };
    expect(await recordOf(restarted)).toMatchObject(expected);
    expect(await attemptPublishOf(restarted)).toMatchObject(expected);
    expect(await sweepStalePushing({ ctx: restarted.state.ctx })).toMatchObject({ swept: 0 });
    const rows = publishRowsOf({ delegations: await delegationsOf(restarted) });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.line).toMatchObject({ state: 'failed', canRetry: true });
  });

  it('leaves a push another window started a moment ago alone, and sweeps it once it is old', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    await leavePushing({ world, startedAt: nowOf({ world }) });
    const booted = restartedWorld({ world, isLeaseLapsed: false });

    const early = await sweepStalePushing({ ctx: booted.state.ctx });

    expect(early).toMatchObject({ swept: 0, live: 1 });
    expect(await recordOf(world)).toMatchObject({ state: 'pushing', isConfirmed: true });

    world.state.world.clock.advance({ ms: PUSH_LIVE_WINDOW_MS + 1 });
    const late = await sweepStalePushing({ ctx: booted.state.ctx });

    expect(late).toMatchObject({ swept: 1, live: 0 });
    expect(await recordOf(world)).toMatchObject({ state: 'failed', isRetryable: true });
  });

  it('leaves a push alone while its three network steps could still be running', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    await leavePushing({ world, startedAt: nowOf({ world }) });
    const booted = restartedWorld({ world, isLeaseLapsed: false });

    world.state.world.clock.advance({ ms: NETWORK_STEPS_MS });
    const during = await sweepStalePushing({ ctx: booted.state.ctx });

    expect(during).toMatchObject({ swept: 0, live: 1 });
    expect(await recordOf(world)).toMatchObject({ state: 'pushing', isConfirmed: true });

    world.state.world.clock.advance({ ms: PUSH_LIVE_WINDOW_MS });
    const after = await sweepStalePushing({ ctx: booted.state.ctx });

    expect(after).toMatchObject({ swept: 1, live: 0 });
  });

  it('sweeps the rows after one that throws and reports the error', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE, NOTIFY_FORCE] });
    await leavePushing({ world });
    const restarted = restartedWorld({ world });
    const flaky = withWriteHook({
      ctx: restarted.state.ctx,
      beforeWrite: failWritesFrom({ from: 1, until: 1 }),
    });

    const swept = await sweepStalePushing({ ctx: flaky });

    expect(swept.swept).toBe(1);
    expect(swept.failed).toHaveLength(1);
    const states = [await recordOf(world, 0), await recordOf(world, 1)].map(({ state }) => state);
    expect(states.sort()).toEqual(['failed', 'pushing']);
  });

  it('sweeps once without blocking and again after the window when a push was live', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    await leavePushing({ world, startedAt: nowOf({ world }) });
    const booted = restartedWorld({ world, isLeaseLapsed: false });
    const onError = vi.fn();
    const sweep = createPushSweep({ ctx: booted.state.ctx, onError });

    await sweep();
    await sweep();
    expect(await recordOf(world)).toMatchObject({ state: 'pushing' });

    world.state.world.clock.advance({ ms: PUSH_LIVE_WINDOW_MS + 1 });
    await sweep();
    expect(await recordOf(world)).toMatchObject({ state: 'failed', isRetryable: true });

    world.state.world.clock.advance({ ms: PUSH_LIVE_WINDOW_MS + 1 });
    await sweep();
    expect(onError).not.toHaveBeenCalled();
  });

  it('sweeps a row again after the database could not settle it', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    await leavePushing({ world });
    const restarted = restartedWorld({ world });
    const flaky = withWriteHook({
      ctx: restarted.state.ctx,
      beforeWrite: failWritesFrom({ from: 1, until: 1 }),
    });
    const onError = vi.fn();
    const sweep = createPushSweep({ ctx: flaky, onError });

    await sweep();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(await recordOf(world)).toMatchObject({ state: 'pushing' });

    await sweep();
    expect(await recordOf(world)).toMatchObject({ state: 'pushing' });

    world.state.world.clock.advance({ ms: PUSH_SWEEP_RETRY_MS });
    await sweep();
    expect(await recordOf(world)).toMatchObject({ state: 'failed', isRetryable: true });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('sweeps again after the query itself threw', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    await leavePushing({ world });
    const restarted = restartedWorld({ world });
    const db = Object.create(restarted.state.ctx.db);
    let calls = 0;
    db.select = async (...args: Parameters<typeof restarted.state.ctx.db.select>) => {
      calls += 1;
      if (calls === 1) {
        throw new Error(DB_BUSY);
      }
      return restarted.state.ctx.db.select(...args);
    };
    const onError = vi.fn();
    const sweep = createPushSweep({ ctx: { ...restarted.state.ctx, db }, onError });

    await sweep();
    expect(onError).toHaveBeenCalledTimes(1);

    world.state.world.clock.advance({ ms: PUSH_SWEEP_RETRY_MS });
    await sweep();
    expect(await recordOf(world)).toMatchObject({ state: 'failed', isRetryable: true });
  });

  it('leaves a push that waits for an answer, and a finished one, alone on boot', async () => {
    const waiting = await settle({ publishes: [LEDGER_FORCE] });
    const done = await settle({ publishes: [LEDGER_PUSH] });

    expect(await sweepStalePushing({ ctx: waiting.state.ctx })).toMatchObject({ swept: 0 });
    expect(await sweepStalePushing({ ctx: done.state.ctx })).toMatchObject({ swept: 0 });

    expect(await recordOf(waiting)).toMatchObject({ state: 'awaiting_confirm' });
    expect(await recordOf(done)).toMatchObject({ state: 'pushed' });
  });

  it('asks again before a force push is retried after the boot sweep', async () => {
    const world = await settle({ publishes: [LEDGER_FORCE] });
    await leavePushing({ world });
    const restarted = restartedWorld({ world });
    await sweepStalePushing({ ctx: restarted.state.ctx });

    const retried = await restarted.runtime.publish({
      act: 'retry',
      delegationIds: await idsOf(restarted),
    });

    expect(retried.rows[0]?.state).toBe('awaiting_confirm');
    expect(restarted.state.ports.pushes).toEqual([]);
    const confirmed = await restarted.runtime.publish({
      act: 'confirm',
      delegationIds: await idsOf(restarted),
    });
    expect(confirmed.rows[0]).toMatchObject({ state: 'pushed' });
    expect(restarted.state.ports.pushes).toHaveLength(1);
  });

  it('pushes a plain push again after the boot sweep with one retry', async () => {
    const world = await settle({ publishes: [LEDGER_PUSH] });
    await leavePushing({ world });
    const restarted = restartedWorld({ world });
    await sweepStalePushing({ ctx: restarted.state.ctx });

    const retried = await restarted.runtime.publish({
      act: 'retry',
      delegationIds: await idsOf(restarted),
    });

    expect(retried.rows[0]).toMatchObject({ state: 'pushed' });
    expect(restarted.state.ports.pushes).toHaveLength(1);
    expect(await recordOf(restarted)).toMatchObject({ state: 'pushed' });
  });
});
