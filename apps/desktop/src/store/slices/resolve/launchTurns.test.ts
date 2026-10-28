// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { dropLaunchTurns, heldLaunchIdOf, queueLaunchTurns, takeLaunchTurn } from './launchTurns';

const LAUNCH_ID = 'launch-13';

const turn = (threadIds: ReadonlyArray<string>) => ({ threadIds, content: 'Resolve these' });

afterEach(() => {
  dropLaunchTurns({ launchId: LAUNCH_ID });
});

describe('heldLaunchIdOf', () => {
  it('names the launch that still holds a comment for a later turn', () => {
    queueLaunchTurns({ launchId: LAUNCH_ID, turns: [turn(['t12', 't13'])] });

    expect(heldLaunchIdOf({ threadId: 't13' })).toBe(LAUNCH_ID);
    expect(heldLaunchIdOf({ threadId: 't1' })).toBeNull();
  });

  it('lets go of a comment once its turn is taken', () => {
    queueLaunchTurns({ launchId: LAUNCH_ID, turns: [turn(['t12', 't13'])] });

    takeLaunchTurn({ launchId: LAUNCH_ID });

    expect(heldLaunchIdOf({ threadId: 't13' })).toBeNull();
  });
});
