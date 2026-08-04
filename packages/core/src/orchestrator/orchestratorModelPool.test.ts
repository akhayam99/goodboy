import { describe, expect, it } from 'vitest';
import type { OrchestratorRoleDefault } from './types';
import { orchestratorModelPool } from './orchestratorModelPool';

const roleDefaults: ReadonlyArray<OrchestratorRoleDefault> = [
  { role: 'scout', model: 'haiku-4.5', effort: 'low' },
  { role: 'planner', model: 'opus-5', effort: 'high' },
  { role: 'implementer', model: 'sonnet-5', effort: 'medium' },
  { role: 'reviewer', model: 'sonnet-5', effort: 'medium' },
];

describe('orchestratorModelPool', () => {
  it('offers only the models the operator role configuration reaches, in catalog order', () => {
    const pool = orchestratorModelPool({ provider: 'anthropic', roleDefaults });

    expect(pool.map((option) => option.id)).toEqual(['opus-5', 'sonnet-5', 'haiku-4.5']);
  });

  it('leaves the rest of the provider catalog out of the menu', () => {
    const pool = orchestratorModelPool({ provider: 'anthropic', roleDefaults });

    expect(pool.map((option) => option.id)).not.toContain('fable-5');
  });

  it('carries the catalog label and cost note for each offered model', () => {
    const pool = orchestratorModelPool({ provider: 'anthropic', roleDefaults });

    expect(pool[0]).toEqual({ id: 'opus-5', label: 'Opus 5', note: 'deepest reasoning' });
    expect(pool.at(-1)).toEqual({ id: 'haiku-4.5', label: 'Haiku 4.5', note: 'cheap, fast' });
  });

  it('offers nothing when the workspace configures no role defaults', () => {
    expect(orchestratorModelPool({ provider: 'anthropic', roleDefaults: [] })).toEqual([]);
  });
});
