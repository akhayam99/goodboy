import { describe, expect, it } from 'vitest';
import { AUTO_TREE_LIMITS } from '@goodboy/core/auto';
import {
  listAgentQueuedMessages,
  listAutoDelegations,
  replaceAgentQueuedMessages,
} from '@goodboy/db';
import { brandId, type AgentId, type IsoDateTime } from '@goodboy/types';
import { delegationContinueOf } from '../../../../features/auto/delegationContinueOf';
import {
  autoCommand,
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../testing/runtimeWorld';

const SCOUT = {
  role: 'scout',
  task: 'Find the callers of the ledger export.',
  reason: 'Reading code is the work of a scout.',
};

const SCOUT_AGENT = 'id-2';

const doneText = (said: string) => `${said}\n<<step-done id="${SCOUT_AGENT}">>`;

const SCOUT_DONE = doneText('Found three callers.');

const delegationsOf = (world: RuntimeWorld) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

const onlyDelegation = async (world: RuntimeWorld) => {
  const [first] = await delegationsOf(world);
  if (first === undefined) {
    throw new Error('a delegation was expected');
  }
  return first;
};

const runningScout = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10, agentIds: [SCOUT_AGENT] });
  await userSays({ world, id: 'outbox-user-1', text: 'find the ledger export callers' });
  await autoDelegates({ world, spec: { children: [SCOUT] } });
  await autoTurnEnds({ world });
  return world;
};

const settledScout = async (): Promise<RuntimeWorld> => {
  const world = await runningScout();
  await childTurnEnds({ world, index: 0, text: SCOUT_DONE });
  await autoTurnEnds({ world, text: 'The scout found three callers.' });
  return world;
};

describe('Auto continues a child with new instructions', () => {
  it('keeps the agent, its role, its worktree and its route, and briefs the new task', async () => {
    const world = await settledScout();
    const original = await onlyDelegation(world);
    await userSays({ world, id: 'outbox-user-2', text: 'and notify-relay?' });

    const outcome = await autoCommand({
      world,
      verb: 'delegate',
      args: {
        'request-id': 'request-continue',
        spec: JSON.stringify({
          children: [
            { retryOf: original.id, task: 'Also read notify-relay.', reason: 'One more caller.' },
          ],
        }),
      },
    });
    await autoTurnEnds({ world });

    expect(outcome).toMatchObject({ isOk: true });
    const continued = (await delegationsOf(world)).find((row) => row.retryOf === original.id);
    expect(continued).toMatchObject({ childAgentId: original.childAgentId, role: 'scout' });
    expect(continued?.target).toMatchObject({
      mountId: original.target['mountId'],
      worktreePath: original.target['worktreePath'],
    });
    expect(continued?.routing).toMatchObject({ provider: 'anthropic', model: 'sonnet' });
    expect(
      continued === undefined ? null : delegationContinueOf({ delegation: continued }),
    ).toEqual({ from: 'auto', text: 'Also read notify-relay.' });
    const turn = world.state.ports.childTurns.at(-1);
    expect(turn?.role).toBe('scout');
    expect(turn?.text).toContain('**New instructions** Also read notify-relay.');
    expect(turn?.text).toContain('Do not start over.');
  });

  it('counts each continue with a new task toward the re-brief cap', async () => {
    const world = await settledScout();
    let latest = await onlyDelegation(world);
    for (let round = 0; round < AUTO_TREE_LIMITS.rebriefsPerTask; round += 1) {
      await userSays({ world, id: `outbox-user-round-${round}`, text: `and part ${round}?` });
      expect(
        await autoCommand({
          world,
          verb: 'delegate',
          args: {
            'request-id': `request-continue-${round}`,
            spec: JSON.stringify({
              children: [{ retryOf: latest.id, task: `Read part ${round}.`, reason: 'More.' }],
            }),
          },
        }),
      ).toMatchObject({ isOk: true });
      await autoTurnEnds({ world });
      await childTurnEnds({ world, index: round + 1, text: doneText(`Read part ${round}.`) });
      await autoTurnEnds({ world, text: `Part ${round} is read.` });
      const previous = latest.id;
      const next = (await delegationsOf(world)).find((row) => row.retryOf === previous);
      if (next === undefined) {
        throw new Error('a continued delegation was expected');
      }
      latest = next;
    }
    await userSays({ world, id: 'outbox-user-again', text: 'and one more part?' });

    const refused = await autoCommand({
      world,
      verb: 'delegate',
      args: {
        'request-id': 'request-continue-again',
        spec: JSON.stringify({
          children: [{ retryOf: latest.id, task: 'Read one more part.', reason: 'More.' }],
        }),
      },
    });

    expect(refused).toMatchObject({ isOk: false, code: 'task_rebrief_limit' });
  });

  it('still refuses a role on a continue', async () => {
    const world = await settledScout();
    const original = await onlyDelegation(world);
    await userSays({ world, id: 'outbox-user-2', text: 'and notify-relay?' });

    const outcome = await autoCommand({
      world,
      verb: 'delegate',
      args: {
        'request-id': 'request-continue',
        spec: JSON.stringify([
          { retryOf: original.id, task: 'Edit it.', role: 'implementer', reason: 'x' },
        ]),
      },
    });

    expect(outcome).toMatchObject({ isOk: false, code: 'spec_invalid' });
  });
});

describe('a person writes to a child Auto started', () => {
  it('continues its delegation, confined and routed, and the answer reaches Auto', async () => {
    const world = await settledScout();
    const original = await onlyDelegation(world);

    const outcome = await world.runtime.continueChild({
      childAgentId: original.childAgentId,
      text: 'Why did you skip the tests folder?',
      from: 'user',
    });
    await world.runtime.settled();

    expect(outcome).toMatchObject({ kind: 'continued' });
    const turn = world.state.ports.childTurns.at(-1);
    expect(world.state.ports.childTurns).toHaveLength(2);
    expect(turn?.childAgentId).toBe(original.childAgentId);
    expect(turn?.role).toBe('scout');
    expect(turn?.routedModel).toEqual(world.state.ports.childTurns[0]?.routedModel);
    expect(turn?.mountTarget).toEqual(world.state.ports.childTurns[0]?.mountTarget);
    expect(turn?.text).toContain('**New instructions** Why did you skip the tests folder?');

    await childTurnEnds({ world, index: 1, text: doneText('The tests folder is generated.') });

    expect(world.state.ports.autoTurns.at(-1)?.text).toContain('The tests folder is generated.');
    const continued = (await delegationsOf(world)).find((row) => row.retryOf === original.id);
    expect(continued).toMatchObject({ state: 'settled' });
    expect(
      continued === undefined ? null : delegationContinueOf({ delegation: continued }),
    ).toEqual({ from: 'user', text: 'Why did you skip the tests folder?' });
  });

  it('keeps the plain turn for an agent outside Auto and waits on a working child', async () => {
    const world = await runningScout();
    const original = await onlyDelegation(world);

    expect(
      await world.runtime.continueChild({
        childAgentId: brandId<AgentId>({ value: 'agent-plain' }),
        text: 'hello',
        from: 'user',
      }),
    ).toEqual({ kind: 'plain' });
    expect(
      await world.runtime.continueChild({
        childAgentId: original.childAgentId,
        text: 'hello',
        from: 'user',
        settleWaitMs: 0,
      }),
    ).toMatchObject({ kind: 'working' });
    expect(world.state.ports.childTurns).toHaveLength(1);
  });

  it('refuses files on a child of a live tree and continues nothing', async () => {
    const world = await settledScout();
    const original = await onlyDelegation(world);

    expect(
      await world.runtime.continueChild({
        childAgentId: original.childAgentId,
        text: 'See the screenshot.',
        from: 'user',
        hasFiles: true,
      }),
    ).toMatchObject({ kind: 'refused', code: 'files' });
    expect(world.state.ports.childTurns).toHaveLength(1);
  });

  it('keeps the plain turn, files included, once the tree has stopped', async () => {
    const world = await settledScout();
    const original = await onlyDelegation(world);
    await world.runtime.stop(world.treeId);

    expect(
      await world.runtime.continueChild({
        childAgentId: original.childAgentId,
        text: 'See the screenshot.',
        from: 'user',
        hasFiles: true,
      }),
    ).toEqual({ kind: 'plain' });
  });
});

describe('Auto messages a working child', () => {
  it('queues the message, and it goes on as the next turn once the turn ends', async () => {
    const world = await runningScout();
    const original = await onlyDelegation(world);

    expect(
      await autoCommand({
        world,
        verb: 'message',
        args: { delegation: original.id, text: 'Skip the tests folder.' },
      }),
    ).toMatchObject({ isOk: true, data: { queued: true } });

    const [queued] = world.state.ports.childMessages;
    expect(queued).toMatchObject({
      agentId: original.childAgentId,
      text: 'Skip the tests folder.',
    });
    expect(queued?.messageId.startsWith(`auto-message:${original.id}:`)).toBe(true);
    expect(world.state.ports.childTurns).toHaveLength(1);

    await childTurnEnds({ world, index: 0, text: SCOUT_DONE });
    const outcome = await world.runtime.continueChild({
      childAgentId: original.childAgentId,
      text: 'Skip the tests folder.',
      from: 'auto-message',
    });
    await autoTurnEnds({ world });

    expect(outcome).toMatchObject({ kind: 'continued' });
    expect(world.state.ports.childTurns.at(-1)?.text).toContain(
      '**New instructions** Skip the tests folder.',
    );
    await childTurnEnds({ world, index: 1, text: doneText('Skipped it, nothing else changes.') });
    expect(world.state.ports.autoTurns.at(-1)?.text).toContain('Skipped it, nothing else changes.');
  });

  it('refuses the fifth message to one child with message_limit', async () => {
    const world = await runningScout();
    const original = await onlyDelegation(world);
    const db = world.state.world.db;
    const kept: Array<{ id: string; content: string }> = [];
    world.state.ports.setChildMessageSink(async ({ agentId, messageId, text }) => {
      kept.push({ id: messageId, content: text });
      await replaceAgentQueuedMessages(db, {
        agentId,
        messages: kept.map((row) => ({
          ...row,
          agentId,
          attachments: [],
          override: null,
          createdAt: brandId<IsoDateTime>({ value: '2026-11-08T10:00:00.000Z' }),
        })),
      });
    });
    const send = (index: number) =>
      autoCommand({
        world,
        verb: 'message',
        args: { delegation: original.id, text: `note ${index}` },
      });

    for (const index of [1, 2, 3, 4]) {
      expect(await send(index)).toMatchObject({ isOk: true });
    }
    expect(await send(5)).toMatchObject({ isOk: false, code: 'message_limit' });

    const otherWindow = await listAgentQueuedMessages(db, [original.childAgentId]);
    expect(otherWindow.map((row) => row.content)).toEqual(['note 1', 'note 2', 'note 3', 'note 4']);
  });

  it('shows a second window the queued message once', async () => {
    const world = await runningScout();
    const original = await onlyDelegation(world);
    const db = world.state.world.db;
    world.state.ports.setChildMessageSink(async ({ agentId, messageId, text }) => {
      await replaceAgentQueuedMessages(db, {
        agentId,
        messages: [
          {
            id: messageId,
            agentId,
            content: text,
            attachments: [],
            override: null,
            createdAt: brandId<IsoDateTime>({ value: '2026-11-08T10:00:00.000Z' }),
          },
        ],
      });
    });

    expect(
      await autoCommand({
        world,
        verb: 'message',
        args: { delegation: original.id, text: 'Skip the tests folder.' },
      }),
    ).toMatchObject({ isOk: true, data: { queued: true, sent: 1 } });

    const otherWindow = await listAgentQueuedMessages(db, [original.childAgentId]);
    expect(otherWindow).toHaveLength(1);
    expect(otherWindow[0]?.content).toBe('Skip the tests folder.');
    expect(otherWindow[0]?.id.startsWith(`auto-message:${original.id}:`)).toBe(true);
  });

  it('refuses a message to a child that already ended', async () => {
    const world = await settledScout();
    const original = await onlyDelegation(world);

    expect(
      await autoCommand({
        world,
        verb: 'message',
        args: { delegation: original.id, text: 'one more thing' },
      }),
    ).toMatchObject({ isOk: false, code: 'not_running' });
  });
});

describe('Auto stops a child', () => {
  it('runs the stop, keeps the work and reads Stopped by Auto with the reason', async () => {
    const world = await runningScout();
    const original = await onlyDelegation(world);

    expect(
      await autoCommand({
        world,
        verb: 'stop',
        args: { delegation: original.id, reason: 'The user no longer needs it.' },
      }),
    ).toMatchObject({ isOk: true, data: { stopped: true } });
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(world.state.ports.cancels).toEqual([
      expect.objectContaining({ agentId: original.childAgentId, by: 'auto' }),
    ]);
    expect(await onlyDelegation(world)).toMatchObject({
      state: 'settled',
      outcome: 'stopped',
      reason: 'Stopped by Auto: The user no longer needs it.',
    });
  });

  it("keeps Auto's reason when the child takes its time to stop", async () => {
    const world = await runningScout();
    const original = await onlyDelegation(world);
    world.state.ports.setCancelOutcome({ outcome: 'still_running' });

    expect(
      await autoCommand({
        world,
        verb: 'stop',
        args: { delegation: original.id, reason: 'The user no longer needs it.' },
      }),
    ).toMatchObject({ isOk: true, data: { stopped: false, stopping: true } });
    expect(await onlyDelegation(world)).toMatchObject({ state: 'running', isStopping: true });

    await childTurnEnds({ world, index: 0, text: 'Half way.', overrides: { exit: 'cancelled' } });
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(await onlyDelegation(world)).toMatchObject({
      state: 'settled',
      outcome: 'stopped',
      reason: 'Stopped by Auto: The user no longer needs it.',
    });
  });

  it('never reopens a child Auto stopped when its queued message arrives after a late exit', async () => {
    const world = await runningScout();
    const original = await onlyDelegation(world);
    await autoCommand({
      world,
      verb: 'message',
      args: { delegation: original.id, text: 'Skip the tests folder.' },
    });
    world.state.ports.setCancelOutcome({ outcome: 'still_running' });
    await autoCommand({
      world,
      verb: 'stop',
      args: { delegation: original.id, reason: 'The user no longer needs it.' },
    });
    await childTurnEnds({ world, index: 0, text: 'Half way.', overrides: { exit: 'cancelled' } });
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(
      await world.runtime.continueChild({
        childAgentId: original.childAgentId,
        text: 'Skip the tests folder.',
        from: 'auto-message',
      }),
    ).toEqual({ kind: 'plain' });
    expect(world.state.ports.childTurns).toHaveLength(1);
    expect(await delegationsOf(world)).toHaveLength(1);
    expect(await onlyDelegation(world)).toMatchObject({ state: 'settled', outcome: 'stopped' });
  });

  it('answers a stop on a child that already ended without stopping anything', async () => {
    const world = await settledScout();
    const original = await onlyDelegation(world);

    expect(
      await autoCommand({
        world,
        verb: 'stop',
        args: { delegation: original.id, reason: 'not needed' },
      }),
    ).toMatchObject({ isOk: true, data: { stopped: false, alreadyEnded: true } });
    expect(world.state.ports.cancels).toEqual([]);
  });
});
