import { describe, expect, it } from 'vitest';
import { getAutoTree, listAutoTreesToRecover } from '@goodboy/db';
import {
  autoTurnEnds,
  autoTurnEndsWithBlock,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../../store/runtime/auto/testing/runtimeWorld';
import { moveAutoRestingPhase } from './moveAutoRestingPhase';

const treeOf = (world: RuntimeWorld) =>
  getAutoTree({ db: world.state.world.db, treeId: world.treeId });

type MoveParams = {
  readonly world: RuntimeWorld;
  readonly from: 'answering' | 'done' | 'finished';
  readonly to: 'answering' | 'done' | 'finished';
};

const move = ({ world, from, to }: MoveParams) =>
  moveAutoRestingPhase({
    db: world.state.world.db,
    treeId: world.treeId,
    from,
    to,
    nowMs: world.state.world.clock.now(),
  });

const resting = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  await userSays({ world, id: 'outbox-user-1', text: 'Why does the ledger export stall?' });
  await autoTurnEnds({ world, text: 'The export waits on a lock in ledger-core.' });
  return world;
};

describe('Auto rests and only the user finishes it', () => {
  it('leaves the tree resting when Auto sends its own finish block', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await userSays({ world, id: 'outbox-user-1', text: 'Map the ledger export' });

    await autoTurnEndsWithBlock({
      world,
      block: { action: 'finish', summary: 'The export is mapped.' },
    });

    const tree = await treeOf(world);
    expect(tree?.phase).not.toBe('finished');
    expect(['answering', 'done']).toContain(tree?.phase);
  });

  it('marks a resting tree finished and keeps it out of recovery', async () => {
    const world = await resting();
    const before = await treeOf(world);
    expect(before?.phase).toBe('answering');

    await move({ world, from: 'answering', to: 'finished' });

    expect(await treeOf(world)).toMatchObject({ phase: 'finished' });
    expect(await listAutoTreesToRecover({ db: world.state.world.db })).toEqual([]);
  });

  it('undoes Mark finished back to the phase it came from', async () => {
    const world = await resting();
    await move({ world, from: 'answering', to: 'finished' });

    await move({ world, from: 'finished', to: 'answering' });

    expect(await treeOf(world)).toMatchObject({ phase: 'answering' });
  });

  it('reopens a finished tree when the user writes again', async () => {
    const world = await resting();
    await move({ world, from: 'answering', to: 'finished' });
    const turnsBefore = world.state.ports.autoTurns.length;

    await userSays({ world, id: 'outbox-user-2', text: 'One more thing: add a test.' });

    expect(world.state.ports.autoTurns).toHaveLength(turnsBefore + 1);
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding' });
  });

  it('refuses while Auto is mid turn, and leaves the tree as it was', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await userSays({ world, id: 'outbox-user-1', text: 'Map the ledger export' });
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding' });

    await expect(move({ world, from: 'answering', to: 'finished' })).rejects.toThrow(
      'Auto is working again. Mark it finished once it rests.',
    );
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding' });
  });
});
