import { describe, expect, it } from 'vitest';
import { AUTO_BLOCK_TEXT } from '@goodboy/core';
import {
  getAutoTree,
  listAutoAttemptsOfTree,
  listAutoDelegations,
  listAutoOutbox,
  setAutoTreeCapIfUnchanged,
} from '@goodboy/db';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const TWO_WRITERS = {
  children: [
    {
      role: 'implementer',
      task: 'add the export to ledger-core',
      reason: 'a change to the code',
      mount: 'mount-ledger-core',
    },
    {
      role: 'docs',
      task: 'document the export in notify-relay',
      reason: 'the docs change',
      mount: 'mount-notify-relay',
    },
  ],
};

const ONE_WRITER = { children: [TWO_WRITERS.children[0]] };

const QUESTION =
  'I need a choice.\n<<ctx-question blocking="true">>Which export format?<</ctx-question>>';

const done = (childAgentId: string, text = 'Finished.') =>
  `${text}\n<<step-done id="${childAgentId}">>`;

type StartParams = {
  readonly capUsd: number | null;
  readonly spec: unknown;
};

const started = async ({ capUsd, spec }: StartParams): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: capUsd ?? 5 });
  if (capUsd === null) {
    await setAutoTreeCapIfUnchanged({
      db: world.state.world.db,
      treeId: world.treeId,
      expectedCapUsd: 5,
      capUsd: null,
      nowMs: world.state.world.clock.now(),
    });
  }
  await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
  await autoDelegates({ world, spec });
  await autoTurnEnds({ world });
  return world;
};

const treeOf = (world: RuntimeWorld) =>
  getAutoTree({ db: world.state.world.db, treeId: world.treeId });

const delegationsOf = (world: RuntimeWorld) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

const raiseTo = async (world: RuntimeWorld, capUsd: number | null) => {
  const tree = await treeOf(world);
  await setAutoTreeCapIfUnchanged({
    db: world.state.world.db,
    treeId: world.treeId,
    expectedCapUsd: tree?.capUsd ?? null,
    capUsd,
    nowMs: world.state.world.clock.now(),
  });
  await world.runtime.drive(world.treeId);
  await world.runtime.settled();
};

const bothChildrenEnd = async (world: RuntimeWorld, costs: readonly [number, number]) => {
  const [first, second] = world.state.ports.childTurns;
  if (first === undefined || second === undefined) {
    throw new Error('two children were expected');
  }
  await childTurnEnds({
    world,
    index: 0,
    text: done(first.childAgentId, 'Added the export.'),
    overrides: { costUsd: costs[0] },
  });
  await childTurnEnds({
    world,
    index: 1,
    text: done(second.childAgentId, 'Documented it.'),
    overrides: { costUsd: costs[1] },
  });
};

describe('the limit never throws away work', () => {
  it('lets two running children finish past the limit and keeps both results', async () => {
    const world = await started({ capUsd: 5, spec: TWO_WRITERS });

    await bothChildrenEnd(world, [4, 2]);

    expect(world.state.ports.cancels).toEqual([]);
    expect(
      (await delegationsOf(world)).map((delegation) => [delegation.state, delegation.outcome]),
    ).toEqual([
      ['settled', 'completed'],
      ['settled', 'completed'],
    ]);
    expect(await treeOf(world)).toMatchObject({
      phase: 'blocked',
      blockedReason: AUTO_BLOCK_TEXT.budget,
    });
    const pending = await listAutoOutbox({
      db: world.state.world.db,
      treeId: world.treeId,
      states: ['pending'],
    });
    expect(pending.filter((row) => row.kind === 'results')).toHaveLength(1);
    expect(world.state.ports.autoTurns).toHaveLength(1);
    expect(world.errors).toEqual([]);
  });

  it('delivers both results in one Auto turn once the limit is raised', async () => {
    const world = await started({ capUsd: 5, spec: TWO_WRITERS });
    await bothChildrenEnd(world, [4, 2]);

    await raiseTo(world, 10);

    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(world.state.ports.autoTurns[1]?.text).toContain('Added the export.');
    expect(world.state.ports.autoTurns[1]?.text).toContain('Documented it.');
    expect((await treeOf(world))?.phase).toBe('deciding');
    expect(world.errors).toEqual([]);
  });

  it('stays paused when the raise still does not cover a turn, keeping the results', async () => {
    const world = await started({ capUsd: 5, spec: TWO_WRITERS });
    await bothChildrenEnd(world, [4, 2]);

    await raiseTo(world, 6.2);

    expect(world.state.ports.autoTurns).toHaveLength(1);
    expect((await treeOf(world))?.phase).toBe('blocked');
    const pending = await listAutoOutbox({
      db: world.state.world.db,
      treeId: world.treeId,
      states: ['pending'],
    });
    expect(pending.filter((row) => row.kind === 'results')).toHaveLength(1);
  });

  it('never pauses a tree that has no limit', async () => {
    const world = await started({ capUsd: null, spec: TWO_WRITERS });

    await bothChildrenEnd(world, [40, 25]);

    expect((await treeOf(world))?.phase).toBe('deciding');
    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(world.state.ports.cancels).toEqual([]);
  });

  it('keeps a child that waits on a question while the tree is paused at the limit', async () => {
    const world = await started({ capUsd: 5, spec: ONE_WRITER });
    await childTurnEnds({ world, index: 0, text: QUESTION, overrides: { costUsd: 6 } });
    expect(await treeOf(world)).toMatchObject({ phase: 'blocked' });

    world.state.world.clock.advance({ ms: 31 * 60_000 });
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect((await delegationsOf(world))[0]?.state).toBe('paused');

    await raiseTo(world, 20);
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect((await delegationsOf(world))[0]?.state).toBe('paused');
    const attempts = await listAutoAttemptsOfTree({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(attempts.map((attempt) => attempt.outcome)).not.toContain('timed_out');
    expect(world.state.ports.autoTurns.at(-1)?.text).toContain('Which export format?');
  });
});
