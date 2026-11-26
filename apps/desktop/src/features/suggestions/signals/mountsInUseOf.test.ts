// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mountsInUseOf } from './mountsInUseOf';

const tree = (
  phase: 'waiting' | 'done' | 'finished' | 'stopped',
  stopState: 'none' | 'requested' = 'none',
) => ({
  tree: { phase, stopState, primaryMountId: 'mount-ledger-core' },
  delegations: [{ target: { mountId: 'mount-notify-relay' } }],
});

describe('mounts a conversation still uses', () => {
  it('counts a running agent and the mount of a tree that can still continue', () => {
    const inUse = mountsInUseOf({
      agents: [
        { status: 'running', mountId: 'mount-payments-api' },
        { status: 'completed', mountId: 'mount-cascadia' },
      ],
      trees: [tree('done')],
    });

    expect([...inUse].sort()).toEqual([
      'mount-ledger-core',
      'mount-notify-relay',
      'mount-payments-api',
    ]);
  });

  it('frees every mount once the tree is over and no agent runs', () => {
    expect(
      mountsInUseOf({
        agents: [{ status: 'completed', mountId: 'mount-ledger-core' }],
        trees: [tree('finished'), tree('stopped'), tree('waiting', 'requested')],
      }).size,
    ).toBe(0);
  });
});
