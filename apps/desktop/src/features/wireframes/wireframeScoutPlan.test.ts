import { describe, expect, it } from 'vitest';
import {
  wireframeScoutInventoryRow,
  WIREFRAME_SCOUT_SKIP_NO_MOUNT,
  type WireframeScoutPlan,
} from './wireframeScoutPlan';
import { WIREFRAME_SCOUTS } from './wireframeScoutRoles';

const READY: WireframeScoutPlan = {
  kind: 'ready',
  root: 'apps/web',
  rootReason: '"web" in the goal or brief names this workspace',
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
    expect(row.detail).toContain('root pinned to apps/web');
    expect(row.detail).toContain(READY.rootReason);
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
