import { describe, expect, it } from 'vitest';
import type { AgentId, ArtifactScoutPlanEntry, MountId } from '@goodboy/types';
import { artifactScoutRoster } from './artifactScoutRoster';
import type { ArtifactMountOption } from './artifactMountChoice';
import type { WireframeScoutProgress } from '../wireframes/wireframeScoutProgress';

const MOUNT_ID = 'mount-ledger' as MountId;

const mounts: ReadonlyArray<ArtifactMountOption> = [
  {
    mountId: MOUNT_ID,
    mountName: 'ledger-core',
    branch: 'ak/fix-posting-rounding',
    baseBranch: 'main',
    worktreePath: '/tmp/ledger',
  },
];

const planEntry = (overrides: Partial<ArtifactScoutPlanEntry> = {}): ArtifactScoutPlanEntry => ({
  roleId: 'screens-and-routes',
  mountId: MOUNT_ID,
  root: '/tmp/ledger',
  reason: 'the batch list already renders the totals',
  agentId: 'agent-scout-screens' as AgentId,
  ...overrides,
});

describe('artifactScoutRoster', () => {
  it('reads a planned scout that has not started yet as planned', () => {
    const rows = artifactScoutRoster({
      plan: [planEntry({ agentId: null })],
      progress: [],
      mounts,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe('planned');
    expect(rows[0]?.name).toBe('screens and routes');
    expect(rows[0]?.branch).toBe('ak/fix-posting-rounding');
    expect(rows[0]?.reason).toBe('the batch list already renders the totals');
  });

  it('takes the live state, elapsed and claim count from the agent once it runs', () => {
    const progress: ReadonlyArray<WireframeScoutProgress> = [
      {
        agentId: 'agent-scout-screens' as AgentId,
        name: 'screens and routes',
        state: 'done',
        detail: '14s',
        claims: '8 of 11 claims verified',
      },
    ];
    const rows = artifactScoutRoster({ plan: [planEntry()], progress, mounts });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe('done');
    expect(rows[0]?.detail).toBe('14s');
    expect(rows[0]?.claims).toBe('8 of 11 claims verified');
    expect(rows[0]?.root).toBe('/tmp/ledger');
  });

  it('keeps a scout the plan never recorded, which is every run made before the plan existed', () => {
    const progress: ReadonlyArray<WireframeScoutProgress> = [
      {
        agentId: 'agent-scout-data' as AgentId,
        name: 'data and contracts',
        state: 'running',
        detail: null,
        claims: null,
      },
    ];
    const rows = artifactScoutRoster({ plan: [], progress, mounts });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('data and contracts');
    expect(rows[0]?.root).toBeNull();
    expect(rows[0]?.reason).toBeNull();
  });

  it('leaves the branch empty when the mount the plan named is gone', () => {
    const rows = artifactScoutRoster({
      plan: [planEntry({ mountId: 'mount-missing' as MountId })],
      progress: [],
      mounts,
    });
    expect(rows[0]?.branch).toBeNull();
    expect(rows[0]?.root).toBe('/tmp/ledger');
  });

  it('reads nothing as nothing, so session summary can say it read no repository', () => {
    expect(artifactScoutRoster({ plan: [], progress: [], mounts })).toEqual([]);
  });
});
