import { describe, expect, it } from 'vitest';
import { AUTO_TREE_LIMITS } from '@goodboy/core/auto';
import {
  listAgentQueuedMessages,
  listAutoDelegations,
  replaceAgentQueuedMessages,
  setArtifactStatus,
} from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId, type ArtifactId, type IsoDateTime } from '@goodboy/types';
import { delegationContinueOf } from '../../../../features/auto/delegationContinueOf';
import { writeAutoLevel } from '../level/writeAutoLevel';
import { registerPlan } from '../testing/autoWorld';
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

  it('counts the continues of one delegate block together toward the re-brief cap', async () => {
    const world = await settledScout();
    const chain = [await onlyDelegation(world)];
    for (let round = 0; round < AUTO_TREE_LIMITS.rebriefsPerTask - 1; round += 1) {
      const latest = chain[chain.length - 1];
      await userSays({ world, id: `outbox-user-round-${round}`, text: `and part ${round}?` });
      await autoCommand({
        world,
        verb: 'delegate',
        args: {
          'request-id': `request-continue-${round}`,
          spec: JSON.stringify({
            children: [{ retryOf: latest?.id, task: `Read part ${round}.`, reason: 'More.' }],
          }),
        },
      });
      await autoTurnEnds({ world });
      await childTurnEnds({ world, index: round + 1, text: doneText(`Read part ${round}.`) });
      await autoTurnEnds({ world, text: `Part ${round} is read.` });
      const next = (await delegationsOf(world)).find((row) => row.retryOf === latest?.id);
      if (next === undefined) {
        throw new Error('a continued delegation was expected');
      }
      chain.push(next);
    }
    await userSays({ world, id: 'outbox-user-both', text: 'two more parts?' });
    const [, middle, last] = chain;

    const refused = await autoCommand({
      world,
      verb: 'delegate',
      args: {
        'request-id': 'request-continue-both',
        spec: JSON.stringify({
          children: [
            { retryOf: last?.id, task: 'Read part A.', reason: 'More.' },
            { retryOf: middle?.id, task: 'Read part B.', reason: 'More.' },
          ],
        }),
      },
    });

    expect(refused).toMatchObject({ isOk: false, code: 'task_rebrief_limit' });
    expect(await delegationsOf(world)).toHaveLength(chain.length);
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

  it('replays the continue of a queued message sent again, and runs it once', async () => {
    const world = await settledScout();
    const original = await onlyDelegation(world);
    const send = () =>
      world.runtime.continueChild({
        childAgentId: original.childAgentId,
        text: 'Why did you skip the tests folder?',
        from: 'user',
        deliveryId: 'queue:message-ledger',
      });

    const first = await send();
    const again = await send();

    expect(first).toMatchObject({ kind: 'continued' });
    expect(again).toEqual(first);
    expect(world.state.ports.childTurns).toHaveLength(2);
    expect(await delegationsOf(world)).toHaveLength(2);
  });

  it('tells a person the agent is still working only while its tree is live', async () => {
    const world = await settledScout();
    const original = await onlyDelegation(world);
    const send = () =>
      world.runtime.continueChild({
        childAgentId: original.childAgentId,
        text: 'hello',
        from: 'user',
        isBusy: true,
      });

    expect(await send()).toMatchObject({ kind: 'working' });
    await world.runtime.stop(world.treeId);
    expect(await send()).toEqual({ kind: 'plain' });
    expect(world.state.ports.childTurns).toHaveLength(1);
  });

  it("holds Auto's message for confirmation at Every step, and lets the person's go on", async () => {
    const world = await settledScout();
    const original = await onlyDelegation(world);
    await writeAutoLevel({
      db: world.state.world.db,
      target: { sessionId: AUTO_SEED_SESSION },
      level: 'step',
    });

    expect(
      await world.runtime.continueChild({
        childAgentId: original.childAgentId,
        text: 'Skip the tests folder.',
        from: 'auto-message',
      }),
    ).toMatchObject({ kind: 'continued' });
    const held = (await delegationsOf(world)).find((row) => row.retryOf === original.id);
    expect(held).toMatchObject({ state: 'awaiting_confirm' });
    expect(world.state.ports.childTurns).toHaveLength(1);
  });

  it('refuses a continue whose plan was discarded, as admission does', async () => {
    const world = await makeRuntimeWorld({
      capUsd: 10,
      agentIds: [SCOUT_AGENT, 'agent-planner'],
      planIds: [{ id: 'plan-1', agentId: 'agent-planner' }],
    });
    const db = world.state.world.db;
    await registerPlan({ world: world.state.world, id: 'plan-1', agentId: 'agent-planner' });
    await userSays({ world, id: 'outbox-user-1', text: 'check the plan against ledger-core' });
    await autoDelegates({ world, spec: { children: [{ ...SCOUT, artifacts: ['plan-1'] }] } });
    await autoTurnEnds({ world });
    await childTurnEnds({ world, index: 0, text: SCOUT_DONE });
    await autoTurnEnds({ world, text: 'The scout read the plan.' });
    const original = await onlyDelegation(world);
    await setArtifactStatus({
      db,
      artifactId: brandId<ArtifactId>({ value: 'plan-1' }),
      status: 'discarded',
      kind: 'plan',
    });

    expect(
      await world.runtime.continueChild({
        childAgentId: original.childAgentId,
        text: 'Read the plan again.',
        from: 'user',
      }),
    ).toMatchObject({ kind: 'refused', code: 'artifact_discarded' });
    expect(await delegationsOf(world)).toHaveLength(1);
  });

  it('lets the person write to a child while Auto revises its plan, and holds Auto back', async () => {
    const world = await makeRuntimeWorld({
      capUsd: 10,
      agentIds: [SCOUT_AGENT, 'agent-planner'],
      planIds: [{ id: 'plan-1', agentId: 'agent-planner' }],
    });
    const db = world.state.world.db;
    await registerPlan({ world: world.state.world, id: 'plan-1', agentId: 'agent-planner' });
    await userSays({ world, id: 'outbox-user-1', text: 'check the plan against ledger-core' });
    await autoDelegates({ world, spec: { children: [{ ...SCOUT, artifacts: ['plan-1'] }] } });
    await autoTurnEnds({ world });
    await childTurnEnds({ world, index: 0, text: SCOUT_DONE });
    await autoTurnEnds({ world, text: 'The scout read the plan.' });
    const original = await onlyDelegation(world);
    await db.execute(
      `UPDATE auto_artifacts SET approval_state = 'revising', open_revise_delegation_id = ?
        WHERE artifact_id = ?`,
      ['delegation-revise', 'plan-1'],
    );

    expect(
      await world.runtime.continueChild({
        childAgentId: original.childAgentId,
        text: 'Skip the tests folder.',
        from: 'auto-message',
      }),
    ).toMatchObject({ kind: 'refused', code: 'artifact_revising' });
    expect(
      await world.runtime.continueChild({
        childAgentId: original.childAgentId,
        text: 'Also fix lint.',
        from: 'user',
      }),
    ).toMatchObject({ kind: 'continued' });
    expect(world.state.ports.childTurns.at(-1)?.text).toContain(
      '**New instructions** Also fix lint.',
    );
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
        runId: `run-note-${index}`,
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

  it('replays the message of a recovered Auto turn without queueing or counting it again', async () => {
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
    const send = () =>
      autoCommand({
        world,
        verb: 'message',
        args: { delegation: original.id, text: 'Skip the tests folder.' },
        runId: 'run-auto-message',
      });

    expect(await send()).toMatchObject({ isOk: true, data: { sent: 1 } });
    expect(await send()).toMatchObject({ isOk: true, data: { replayed: true, sent: 1 } });
    expect(world.state.ports.childMessages).toHaveLength(1);

    const messageId = world.state.ports.childMessages[0]?.messageId ?? '';
    await replaceAgentQueuedMessages(db, { agentId: original.childAgentId, messages: [] });
    await childTurnEnds({ world, index: 0, text: SCOUT_DONE });
    expect(
      await world.runtime.continueChild({
        childAgentId: original.childAgentId,
        text: 'Skip the tests folder.',
        from: 'auto-message',
        deliveryId: `queue:${messageId}`,
      }),
    ).toMatchObject({ kind: 'continued' });

    expect(await send()).toMatchObject({ isOk: true, data: { replayed: true } });
    expect(world.state.ports.childMessages).toHaveLength(1);
  });

  it('queues two messages of one Auto turn, and replays each once', async () => {
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
    const send = (text: string) =>
      autoCommand({
        world,
        verb: 'message',
        args: { delegation: original.id, text },
        runId: 'run-auto-two',
      });

    expect(await send('Skip tests/.')).toMatchObject({ isOk: true, data: { sent: 1 } });
    const second = await send('Also skip docs/.');
    expect(second).toMatchObject({ isOk: true, data: { sent: 2 } });
    expect(second.data).not.toHaveProperty('replayed');
    expect(await send('Skip tests/.')).toMatchObject({ isOk: true, data: { replayed: true } });
    expect(await send('Also skip docs/.')).toMatchObject({ isOk: true, data: { replayed: true } });

    const otherWindow = await listAgentQueuedMessages(db, [original.childAgentId]);
    expect(otherWindow.map((row) => row.content)).toEqual(['Skip tests/.', 'Also skip docs/.']);
    expect(new Set(otherWindow.map((row) => row.id)).size).toBe(2);
  });

  it('never reuses an id of its run once the person removes a row from the middle', async () => {
    const world = await runningScout();
    const original = await onlyDelegation(world);
    const db = world.state.world.db;
    let kept: Array<{ id: string; content: string }> = [];
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
    const send = (text: string) =>
      autoCommand({
        world,
        verb: 'message',
        args: { delegation: original.id, text },
        runId: 'run-auto-middle',
      });

    await send('Skip tests/.');
    await send('Skip docs/.');
    kept = kept.filter((row) => row.content !== 'Skip tests/.');
    await replaceAgentQueuedMessages(db, {
      agentId: original.childAgentId,
      messages: kept.map((row) => ({
        ...row,
        agentId: original.childAgentId,
        attachments: [],
        override: null,
        createdAt: brandId<IsoDateTime>({ value: '2026-11-08T10:00:00.000Z' }),
      })),
    });
    expect(await send('Fix lint.')).toMatchObject({ isOk: true, data: { queued: true } });

    const otherWindow = await listAgentQueuedMessages(db, [original.childAgentId]);
    expect(otherWindow.map((row) => row.content)).toEqual(['Skip docs/.', 'Fix lint.']);
    expect(new Set(otherWindow.map((row) => row.id)).size).toBe(2);
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

  it('refuses the stop and changes nothing when the cancel fails', async () => {
    const world = await runningScout();
    const original = await onlyDelegation(world);
    world.state.ports.setCancelOutcome({ outcome: 'failed' });

    expect(
      await autoCommand({
        world,
        verb: 'stop',
        args: { delegation: original.id, reason: 'The user no longer needs it.' },
      }),
    ).toMatchObject({ isOk: false, code: 'tree_busy' });
    expect(await onlyDelegation(world)).toMatchObject({
      state: 'running',
      isStopping: false,
      reason: null,
    });
  });

  it("keeps Auto's reason when the child's end wins the race with the stop", async () => {
    const world = await runningScout();
    const original = await onlyDelegation(world);
    world.state.ports.setCancelSink(async () => {
      await childTurnEnds({ world, index: 0, text: 'Half way.', overrides: { exit: 'cancelled' } });
    });

    await autoCommand({
      world,
      verb: 'stop',
      args: { delegation: original.id, reason: 'The user no longer needs it.' },
    });
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(await onlyDelegation(world)).toMatchObject({
      state: 'settled',
      outcome: 'stopped',
      reason: 'Stopped by Auto: The user no longer needs it.',
    });
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
