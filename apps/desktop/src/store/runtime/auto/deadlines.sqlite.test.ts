import { describe, expect, it } from 'vitest';
import { getAutoAttempt, insertTurnEvent, listAutoDelegations, listAutoOutbox } from '@goodboy/db';
import { brandId, type IsoDateTime, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import {
  autoCommand,
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  restartedWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const ONE_WRITER = {
  children: [
    { role: 'implementer', task: 'add the export', reason: 'code', mount: 'mount-ledger-core' },
  ],
};

const MINUTE = 60_000;

const started = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
  await autoDelegates({ world, spec: ONE_WRITER });
  await autoTurnEnds({ world });
  return world;
};

type AdvanceParams = {
  readonly world: RuntimeWorld;
  readonly minutes: number;
};

const advance = async ({ world, minutes }: AdvanceParams) => {
  world.state.world.clock.advance({ ms: minutes * MINUTE });
  await world.runtime.drive(world.treeId);
  await world.runtime.settled();
};

type WorldParams = {
  readonly world: RuntimeWorld;
};

const silentFor31Minutes = ({ world }: WorldParams) => advance({ world, minutes: 31 });

let eventCount = 0;

type ChildEventParams = WorldParams & {
  readonly kind?: 'assistant_text' | 'tool_call_start' | 'tool_call_end';
};

const childWrites = async ({ world, kind = 'assistant_text' }: ChildEventParams) => {
  const turn = world.state.ports.childTurns.at(-1);
  if (turn === undefined) {
    throw new Error('a child was expected');
  }
  eventCount += 1;
  await world.state.world.db.execute(
    `INSERT OR IGNORE INTO agents (id, session_id, ordinal, name, status)
     VALUES (?, ?, 50, 'Implementer', 'running')`,
    [turn.childAgentId, turn.sessionId],
  );
  const runId = brandId<ProviderRunId>({ value: turn.runId });
  const at = brandId<IsoDateTime>({
    value: new Date(world.state.world.clock.now()).toISOString(),
  });
  const events = {
    assistant_text: { kind: 'assistant_text', runId, delta: 'Running the ledger tests.', at },
    tool_call_start: {
      kind: 'tool_call_start',
      runId,
      toolUseId: 'tool-build',
      toolName: 'Bash',
      input: 'pnpm build',
      at,
    },
    tool_call_end: {
      kind: 'tool_call_end',
      runId,
      toolUseId: 'tool-build',
      output: 'ok',
      isError: false,
      at,
    },
  } satisfies Record<NonNullable<ChildEventParams['kind']>, TurnEvent>;
  await insertTurnEvent(world.state.world.db, {
    id: `event-child-${eventCount}`,
    sessionId: turn.sessionId,
    agentId: turn.childAgentId,
    event: events[kind],
  });
};

const onlyDelegation = async ({ world }: WorldParams) => {
  const [delegation] = await listAutoDelegations({
    db: world.state.world.db,
    treeId: world.treeId,
  });
  return delegation;
};

describe('a running delegation', () => {
  it('is never cut while it keeps working, even past 45 minutes', async () => {
    const world = await started();

    for (let step = 0; step < 9; step += 1) {
      world.state.world.clock.advance({ ms: 5 * MINUTE });
      await childWrites({ world });
      await world.runtime.drive(world.treeId);
      await world.runtime.settled();
    }

    expect(world.state.ports.cancels).toHaveLength(0);
    expect(await onlyDelegation({ world })).toMatchObject({ state: 'running' });
    expect(world.state.ports.autoTurns).toHaveLength(1);
  });

  it('ignores the old deadline while the agent is busy', async () => {
    const world = await started();
    await advance({ world, minutes: 20 });
    await childWrites({ world });

    await advance({ world, minutes: 25 });

    expect(world.state.ports.cancels).toHaveLength(0);
    expect(await onlyDelegation({ world })).toMatchObject({ state: 'running' });
  });

  it('is stopped after 30 minutes without output or tool activity and settles timed out', async () => {
    const world = await started();

    await silentFor31Minutes({ world });

    expect(world.state.ports.cancels).toHaveLength(1);
    expect(await onlyDelegation({ world })).toMatchObject({
      state: 'settled',
      outcome: 'timed_out',
      reason: 'no_activity',
    });
    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(world.state.ports.autoTurns[1]?.text).toContain(': timed_out, no_activity');
  });

  it('counts the idle time from the last event, not from the start', async () => {
    const world = await started();
    await advance({ world, minutes: 25 });
    await childWrites({ world });

    await advance({ world, minutes: 29 });
    expect(world.state.ports.cancels).toHaveLength(0);

    await advance({ world, minutes: 2 });
    expect(world.state.ports.cancels).toHaveLength(1);
    expect(await onlyDelegation({ world })).toMatchObject({ outcome: 'timed_out' });
  });

  it('waits on a long tool call and counts the quiet time again once it ends', async () => {
    const world = await started();
    await advance({ world, minutes: 1 });
    await childWrites({ world, kind: 'tool_call_start' });

    await advance({ world, minutes: 50 });
    expect(world.state.ports.cancels).toHaveLength(0);

    await childWrites({ world, kind: 'tool_call_end' });
    await advance({ world, minutes: 29 });
    expect(world.state.ports.cancels).toHaveLength(0);

    await advance({ world, minutes: 2 });
    expect(world.state.ports.cancels).toHaveLength(1);
    expect(await onlyDelegation({ world })).toMatchObject({ reason: 'no_activity' });
  });

  it('is continued in its worktree by a retry after it went silent', async () => {
    const world = await started();
    await silentFor31Minutes({ world });
    const original = await onlyDelegation({ world });
    if (original === undefined) {
      throw new Error('a delegation was expected');
    }

    const outcome = await autoCommand({
      world,
      verb: 'delegate',
      args: {
        'request-id': 'request-retry',
        spec: JSON.stringify({
          children: [{ retryOf: original.id, reason: 'it went silent' }],
        }),
      },
    });
    await autoTurnEnds({ world });

    expect(outcome).toMatchObject({ isOk: true, data: { accepted: true } });
    const turns = world.state.ports.childTurns;
    expect(turns).toHaveLength(2);
    expect(turns[1]?.childAgentId).toBe(original.childAgentId);
    expect(turns[1]?.mountTarget).toEqual(turns[0]?.mountTarget);
    expect(turns[1]?.text).toContain('Do not start over.');
    expect(world.errors).toEqual([]);
  });

  it('keeps it running and unjoined while the exit cannot be confirmed', async () => {
    const world = await started();
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }
    world.state.ports.setCancelOutcome({ outcome: 'still_running' }, turn.childAgentId);

    await silentFor31Minutes({ world });

    expect(await onlyDelegation({ world })).toMatchObject({ state: 'running', isStopping: true });
    expect(world.state.ports.autoTurns).toHaveLength(1);
    expect(
      await getAutoAttempt({ db: world.state.world.db, attemptId: turn.attemptId }),
    ).toMatchObject({
      state: 'running',
    });

    world.state.ports.setCancelOutcome({ outcome: 'exited' }, turn.childAgentId);
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(await onlyDelegation({ world })).toMatchObject({
      state: 'settled',
      outcome: 'timed_out',
      isStopping: false,
    });
  });

  it('is not expired on load because an old deadline passed while the app was closed', async () => {
    const world = await started();
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }
    world.state.ports.liveRuns.add(turn.runId);
    world.state.world.clock.advance({ ms: 3 * 60 * MINUTE });
    await world.state.world.db.execute('UPDATE auto_delegations SET deadline_at = ?', [
      world.state.world.clock.now() - 60 * MINUTE,
    ]);

    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(restarted.treeId);
    await restarted.runtime.settled();

    expect(restarted.state.ports.cancels).toHaveLength(0);
    expect(await onlyDelegation({ world: restarted })).toMatchObject({ state: 'running' });

    await advance({ world: restarted, minutes: 31 });

    expect(restarted.state.ports.cancels).toHaveLength(1);
    expect(await onlyDelegation({ world: restarted })).toMatchObject({ reason: 'no_activity' });
  });
});

describe('a delegation paused on a question', () => {
  it('times out after its deadline without touching any process', async () => {
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

    await silentFor31Minutes({ world });

    expect(world.state.ports.cancels).toHaveLength(0);
    expect(await onlyDelegation({ world })).toMatchObject({
      state: 'settled',
      outcome: 'timed_out',
      reason: 'deadline_passed',
    });
    const questions = (
      await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId })
    ).filter((row) => row.kind === 'question');
    expect(questions.map((row) => row.state)).toEqual(['dropped']);
  });
});
