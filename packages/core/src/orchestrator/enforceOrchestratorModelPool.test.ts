import { describe, expect, it } from 'vitest';
import { ROLE_DEFAULTS } from '../roles';
import type { OrchestratorModelOption, OrchestratorRoleDefault, OrchestratorStep } from './types';
import { enforceOrchestratorModelPool } from './enforceOrchestratorModelPool';

const pool: ReadonlyArray<OrchestratorModelOption> = [
  { id: 'opus-5', label: 'Opus 5', note: 'deepest reasoning' },
  { id: 'sonnet-5', label: 'Sonnet 5', note: 'balanced default' },
  { id: 'haiku-4.5', label: 'Haiku 4.5', note: 'cheap, fast' },
];

const roleDefaults: ReadonlyArray<OrchestratorRoleDefault> = [
  { role: 'implementer', model: 'sonnet-5', effort: 'medium' },
  { role: 'planner', model: 'opus-5', effort: 'high' },
];

const step = (overrides: Partial<OrchestratorStep> = {}): OrchestratorStep => ({
  name: 'Implement',
  role: 'implementer',
  promptPrefix: 'Apply the planned change.',
  ...overrides,
});

describe('enforceOrchestratorModelPool', () => {
  it('rejects a model outside the pool and falls back to the role default', () => {
    const result = enforceOrchestratorModelPool({
      step: step({ model: 'fable-5', effort: 'max' }),
      pool,
      roleDefaults,
    });

    expect(result.step.model).toBe('sonnet-5');
    expect(result.step.effort).toBe('medium');
    expect(result.rejection?.requested).toBe('fable-5');
  });

  it('says out loud which pick it refused and what runs instead', () => {
    const result = enforceOrchestratorModelPool({
      step: step({ model: 'fable-5' }),
      pool,
      roleDefaults,
    });

    expect(result.rejection?.note).toContain('fable-5');
    expect(result.rejection?.note).toContain('sonnet-5');
    expect(result.rejection?.note).toContain('outside the routing pool');
  });

  it('lets a deliberate deviation inside the pool through untouched', () => {
    const deviation = step({ model: 'opus-5', effort: 'high' });

    const result = enforceOrchestratorModelPool({ step: deviation, pool, roleDefaults });

    expect(result.step).toBe(deviation);
    expect(result.rejection).toBeNull();
  });

  it('leaves a step that accepts the role default alone', () => {
    const accepted = step();

    const result = enforceOrchestratorModelPool({ step: accepted, pool, roleDefaults });

    expect(result.step).toBe(accepted);
    expect(result.rejection).toBeNull();
  });

  it('falls back to the built-in role default when the workspace configures none', () => {
    const result = enforceOrchestratorModelPool({
      step: step({ role: 'tester', model: 'fable-5' }),
      pool,
      roleDefaults,
    });

    expect(result.step.model).toBe(ROLE_DEFAULTS.tester.model);
    expect(result.step.effort).toBe(ROLE_DEFAULTS.tester.effort);
  });
});
