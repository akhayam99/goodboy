import { describe, expect, it } from 'vitest';
import type { MountId } from '@goodboy/types';
import {
  wireframeScoutInventoryRow,
  WIREFRAME_SCOUT_SKIP_NO_MOUNT,
  type WireframeScoutPlan,
} from './wireframeScoutPlan';
import { WIREFRAME_SCOUTS } from './wireframeScoutRoles';

const ROOT_REASON = '"web" in the goal or brief names this workspace';

const READY: WireframeScoutPlan = {
  kind: 'ready',
  roots: [
    {
      mountId: 'mount-1' as MountId,
      mountName: 'web',
      worktreePath: '/tmp/worktree',
      root: 'apps/web',
      rootReason: ROOT_REASON,
    },
  ],
  scouts: WIREFRAME_SCOUTS,
  modelLabel: 'Claude Haiku 4.5',
};

const TWO_ROOTS: WireframeScoutPlan = {
  kind: 'ready',
  roots: [
    ...(READY.kind === 'ready' ? READY.roots : []),
    {
      mountId: 'mount-2' as MountId,
      mountName: 'api',
      worktreePath: '/tmp/api',
      root: '.',
      rootReason: 'no workspace named the goal, so the repository root is the ground',
    },
  ],
  scouts: WIREFRAME_SCOUTS,
  modelLabel: 'Claude Haiku 4.5',
};

describe('wireframeScoutInventoryRow', () => {
  it('names the scouts, the model, the bound and the pinned root before spending', () => {
    const row = wireframeScoutInventoryRow({ plan: READY });
    expect(row.id).toBe('scouts');
    expect(row.state).toBe('included');
    expect(row.summary).toContain('2 scouts read the repository in parallel');
    expect(row.summary).toContain('screens and routes, data and contracts');
    expect(row.summary).toContain('Claude Haiku 4.5');
    expect(row.summary).toContain('one turn each');
    expect(row.summary).toContain('6 minute bound');
    expect(row.detail).toContain('web: root pinned to apps/web');
    expect(row.detail).toContain(ROOT_REASON);
  });

  it('names a pinned root for every repository the user chose to read', () => {
    const row = wireframeScoutInventoryRow({ plan: TWO_ROOTS });
    expect(row.summary).toContain('2 scouts read 2 repositories in parallel');
    expect(row.detail).toContain('web: root pinned to apps/web');
    expect(row.detail).toContain('api: root pinned to .');
  });

  it('reads missing and says why when nothing is scouted', () => {
    const row = wireframeScoutInventoryRow({
      plan: { kind: 'skipped', reason: WIREFRAME_SCOUT_SKIP_NO_MOUNT },
    });
    expect(row.state).toBe('missing');
    expect(row.summary).toBe(WIREFRAME_SCOUT_SKIP_NO_MOUNT);
    expect(row.detail[0]).toContain('written from the evidence in this pack alone');
  });
});
