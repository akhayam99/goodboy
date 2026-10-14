import { describe, expect, it } from 'vitest';
import { storedDeliveryOf } from '@goodboy/core';
import {
  getAutoTree,
  listAutoAttemptsOfTree,
  listAutoDelegations,
  listAutoOutbox,
} from '@goodboy/db';
import { stopTree } from './stopTree';
import { endedTurn } from './testing/deliveryWorld';
import {
  autoBlockText,
  autoTurnEnds,
  autoTurnEndsWithBlock,
  childTurnEnds,
  makeRuntimeWorld,
  restartedWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const SCOUTS = [
  { role: 'scout', task: 'map the ledger export', reason: 'orientation' },
  { role: 'investigator', task: 'find why the export drifts', reason: 'cause' },
];

const IMPLEMENTER = {
  role: 'implementer',
  task: 'add the export',
  reason: 'a code change',
  mount: 'mount-ledger-core',
};

const delegateBlock = (children: ReadonlyArray<unknown> = SCOUTS, requestId = 'r1') => ({
  action: 'delegate',
  requestId,
  children,
});

const started = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  await userSays({ world, id: 'outbox-user-1', text: 'look into the ledger export' });
  return world;
};

const treeOf = (world: RuntimeWorld) =>
  getAutoTree({ db: world.state.world.db, treeId: world.treeId });

const delegationsOf = (world: RuntimeWorld) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

const refusalsOf = async (world: RuntimeWorld) =>
  (await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId })).filter(
    (row) => row.kind === 'refusal',
  );

const done = (childAgentId: string, text = 'Finished.') =>
  `${text}\n<<step-done id="${childAgentId}">>`;

describe('the delegate action of the block', () => {
  it('admits the children when the turn ends, then starts them', async () => {
    const world = await started();

    await autoTurnEndsWithBlock({ world, block: delegateBlock() });

    const rows = await delegationsOf(world);
    expect(rows.map((row) => row.role)).toEqual(['scout', 'investigator']);
    expect(rows.map((row) => row.requestId)).toEqual(['r1', 'r1']);
    expect(world.state.ports.childTurns).toHaveLength(2);
    expect(await treeOf(world)).toMatchObject({ phase: 'waiting', activeRunId: null });
    expect(await refusalsOf(world)).toHaveLength(0);
    expect(world.errors).toEqual([]);
  });

  it('derives the request id from the run when the block has none', async () => {
    const world = await started();
    const runId = world.state.ports.autoTurns.at(-1)?.runId ?? '';

    await autoTurnEndsWithBlock({
      world,
      block: { action: 'delegate', children: SCOUTS },
    });

    const rows = await delegationsOf(world);
    expect(rows.map((row) => row.requestId)).toEqual([`auto-${runId}`, `auto-${runId}`]);
  });

  it('applies the block when text follows it', async () => {
    const world = await started();

    await autoTurnEndsWithBlock({
      world,
      block: delegateBlock(),
      after: '\n\nI will report back when they are done.',
    });

    expect(await delegationsOf(world)).toHaveLength(2);
  });

  it('applies the last block when there are two', async () => {
    const world = await started();
    const text = `${autoBlockText(delegateBlock(SCOUTS, 'first'))}\nWait.\n${autoBlockText(delegateBlock([SCOUTS[0]], 'second'))}`;

    await autoTurnEnds({ world, text });

    const rows = await delegationsOf(world);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.requestId).toBe('second');
  });

  it('settles a plain answer with no block as before', async () => {
    const world = await started();

    await autoTurnEnds({ world, text: 'The export lives in ledger-core.' });

    expect(await delegationsOf(world)).toHaveLength(0);
    expect(await refusalsOf(world)).toHaveLength(0);
    expect(await treeOf(world)).toMatchObject({ phase: 'answering', noProgressStreak: 0 });
  });

  it('ignores a block in a turn that failed', async () => {
    const world = await started();
    const turn = world.state.ports.autoTurns.at(-1);
    if (turn === undefined) {
      throw new Error('an Auto turn was expected');
    }

    turn.onEnded(
      endedTurn({
        runId: turn.runId,
        deliveryId: turn.deliveryId,
        assistantText: autoBlockText(delegateBlock()),
        exit: 'error',
      }),
    );
    await world.runtime.settled();

    expect(await delegationsOf(world)).toHaveLength(0);
  });
});

describe('the answer and finish actions of the block', () => {
  it('answers the question of a child and resumes it', async () => {
    const world = await started();
    await autoTurnEndsWithBlock({ world, block: delegateBlock([IMPLEMENTER]) });
    await childTurnEnds({
      world,
      index: 0,
      text: 'I need a choice.\n<<ctx-question blocking="true">>Which export format?<</ctx-question>>',
    });
    const [delegation] = await delegationsOf(world);
    const asked = world.state.ports.childTurns[0];
    if (delegation === undefined || asked === undefined) {
      throw new Error('a paused child was expected');
    }

    await autoTurnEndsWithBlock({
      world,
      block: {
        action: 'answer',
        delegation: delegation.id,
        question: `question-${asked.attemptId}`,
        text: 'Use json lines.',
      },
    });

    expect(world.state.ports.childTurns).toHaveLength(2);
    expect(world.state.ports.childTurns[1]?.text).toContain('Use json lines.');
    expect(await refusalsOf(world)).toHaveLength(0);
    expect(world.errors).toEqual([]);
  });

  it('finishes once every agent is done and nothing waits for Auto', async () => {
    const world = await started();
    await autoTurnEndsWithBlock({ world, block: delegateBlock([SCOUTS[0]]) });
    const child = world.state.ports.childTurns[0];
    if (child === undefined) {
      throw new Error('a child was expected');
    }
    await childTurnEnds({ world, index: 0, text: done(child.childAgentId, 'Mapped it.') });
    expect(world.state.ports.autoTurns).toHaveLength(2);

    await autoTurnEndsWithBlock({
      world,
      block: { action: 'finish', summary: 'The export is mapped.' },
    });

    expect(await treeOf(world)).toMatchObject({ phase: 'done' });
    expect(await refusalsOf(world)).toHaveLength(0);
  });
});

describe('a block that cannot be applied', () => {
  it('turns a malformed block into a refusal row that the next delivery shows', async () => {
    const world = await started();

    await autoTurnEnds({ world, text: 'Handing over.\n<<auto>>{"action": "delegate", <</auto>>' });

    const refusals = await refusalsOf(world);
    expect(refusals).toHaveLength(1);
    expect(refusals[0]?.payload).toMatchObject({
      kind: 'refusal',
      action: 'block',
      code: 'spec_invalid',
    });
    expect(world.state.ports.autoTurns).toHaveLength(2);
    const second = world.state.ports.autoTurns[1];
    expect(second?.text).toContain('REFUSED, NOT DONE');
    expect(second?.text).toContain('spec_invalid');
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding', noProgressStreak: 1 });
  });

  it('round trips a refused spec: no children, a refusal row, then the reason in the next turn', async () => {
    const world = await started();

    await autoTurnEndsWithBlock({
      world,
      block: delegateBlock([{ role: 'implementer', task: 'change it', reason: 'a code change' }]),
    });

    expect(await delegationsOf(world)).toHaveLength(0);
    const refusals = await refusalsOf(world);
    expect(refusals).toHaveLength(1);
    expect(refusals[0]?.payload).toMatchObject({ action: 'delegate', code: 'mount_missing' });
    const second = world.state.ports.autoTurns[1];
    expect(second?.text).toContain('your delegate block was refused (mount_missing)');
    expect(second?.text).toContain('mount-ledger-core');
    const accepted = (await refusalsOf(world))[0];
    expect(accepted?.state).toBe('accepted');
    expect(storedDeliveryOf({ value: accepted?.payload })?.rowIds).toContain(String(accepted?.id));
  });

  it('refuses to finish while another agent still works, once even when settled twice', async () => {
    const world = await started();
    await autoTurnEndsWithBlock({ world, block: delegateBlock([SCOUTS[0], IMPLEMENTER]) });
    const index = world.state.ports.childTurns.findIndex((turn) => turn.role === 'implementer');
    await childTurnEnds({
      world,
      index,
      text: 'I need a choice.\n<<ctx-question blocking="true">>Which export format?<</ctx-question>>',
    });
    const turn = world.state.ports.autoTurns.at(-1);
    if (turn === undefined) {
      throw new Error('an Auto turn was expected');
    }
    const ended = endedTurn({
      runId: turn.runId,
      deliveryId: turn.deliveryId,
      assistantText: autoBlockText({ action: 'finish', summary: 'All done.' }),
    });

    turn.onEnded(ended);
    turn.onEnded(ended);
    await world.runtime.settled();

    const refusals = await refusalsOf(world);
    expect(refusals).toHaveLength(1);
    expect(refusals[0]?.payload).toMatchObject({ action: 'finish', code: 'tree_busy' });
    expect(world.state.ports.autoTurns.at(-1)?.text).toContain('your finish block was refused');
  });
});

describe('settling more than once, late, or after a crash', () => {
  it('admits once when the same turn settles twice', async () => {
    const world = await started();
    const turn = world.state.ports.autoTurns.at(-1);
    if (turn === undefined) {
      throw new Error('an Auto turn was expected');
    }
    const ended = endedTurn({
      runId: turn.runId,
      deliveryId: turn.deliveryId,
      assistantText: autoBlockText(delegateBlock()),
    });

    turn.onEnded(ended);
    turn.onEnded(ended);
    await world.runtime.settled();

    expect(await delegationsOf(world)).toHaveLength(2);
    expect(world.state.ports.childTurns).toHaveLength(2);
    expect(await refusalsOf(world)).toHaveLength(0);
    expect(world.errors).toEqual([]);
  });

  it('drops a settle that arrives after the stop and admits nothing', async () => {
    const world = await started();
    const turn = world.state.ports.autoTurns.at(-1);
    if (turn === undefined) {
      throw new Error('an Auto turn was expected');
    }

    await stopTree({ ctx: world.state.ctx, treeId: world.treeId });
    turn.onEnded(
      endedTurn({
        runId: turn.runId,
        deliveryId: turn.deliveryId,
        assistantText: autoBlockText(delegateBlock()),
      }),
    );
    await world.runtime.settled();

    expect(await delegationsOf(world)).toHaveLength(0);
    expect(await refusalsOf(world)).toHaveLength(0);
    expect(await treeOf(world)).toMatchObject({ phase: 'stopped' });
    expect(
      await listAutoAttemptsOfTree({ db: world.state.world.db, treeId: world.treeId }),
    ).toEqual([]);
  });

  it('admits once when a crash between the turn end and the admission is recovered', async () => {
    const world = await started();
    const turn = world.state.ports.autoTurns.at(-1);
    if (turn === undefined) {
      throw new Error('an Auto turn was expected');
    }
    const text = autoBlockText(delegateBlock());

    const restarted = restartedWorld({ world });
    restarted.state.ports.liveRuns.delete(turn.runId);
    restarted.state.ports.runOutcomes.set(turn.runId, {
      assistantText: text,
      exit: 'ok',
      costUsd: 0.1,
    });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(await delegationsOf(restarted)).toHaveLength(2);
    expect(restarted.state.ports.childTurns).toHaveLength(2);
    expect(await refusalsOf(restarted)).toHaveLength(0);
    expect(restarted.errors).toEqual([]);
  });

  it('writes one refusal row when a refused turn is recovered after the row was stored', async () => {
    const world = await started();
    const turn = world.state.ports.autoTurns.at(-1);
    if (turn === undefined) {
      throw new Error('an Auto turn was expected');
    }
    const text = autoBlockText({ action: 'delegate', children: 'not a list' });

    const restarted = restartedWorld({ world });
    restarted.state.ports.liveRuns.delete(turn.runId);
    restarted.state.ports.runOutcomes.set(turn.runId, {
      assistantText: text,
      exit: 'ok',
      costUsd: 0.1,
    });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(await refusalsOf(restarted)).toHaveLength(1);
  });
});
