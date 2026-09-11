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
      provider: 'anthropic',
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
      provider: 'anthropic',
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

    const result = enforceOrchestratorModelPool({
      provider: 'anthropic',
      step: deviation,
      pool,
      roleDefaults,
    });

    expect(result.step).toBe(deviation);
    expect(result.rejection).toBeNull();
  });

  it('leaves a step that accepts the role default alone', () => {
    const accepted = step();

    const result = enforceOrchestratorModelPool({
      provider: 'anthropic',
      step: accepted,
      pool,
      roleDefaults,
    });

    expect(result.step).toBe(accepted);
    expect(result.rejection).toBeNull();
  });

  it('falls back to the built-in role default when the workspace configures none', () => {
    const result = enforceOrchestratorModelPool({
      provider: 'anthropic',
      step: step({ role: 'tester', model: 'fable-5' }),
      pool,
      roleDefaults,
    });

    expect(result.step.model).toBe(ROLE_DEFAULTS.tester.model);
    expect(result.step.effort).toBe(ROLE_DEFAULTS.tester.effort);
  });
});

describe('enforceOrchestratorModelPool, ids that carry combo axes', () => {
  const cursorRoleDefaults: ReadonlyArray<OrchestratorRoleDefault> = [
    { role: 'implementer', model: 'composer-2.5-fast', effort: 'medium' },
  ];
  const cursorPool: ReadonlyArray<OrchestratorModelOption> = [
    { id: 'composer-2.5-fast', label: 'Composer 2.5', note: 'balanced default' },
  ];

  it('lets the configured combo through', () => {
    const deviation = step({ model: 'composer-2.5-fast' });

    const result = enforceOrchestratorModelPool({
      provider: 'cursor',
      step: deviation,
      pool: cursorPool,
      roleDefaults: cursorRoleDefaults,
    });

    expect(result.step).toBe(deviation);
    expect(result.rejection).toBeNull();
  });

  it('refuses a combo the pool never offered', () => {
    const result = enforceOrchestratorModelPool({
      provider: 'cursor',
      step: step({ model: 'composer-2.5-fast' }),
      pool: [{ id: 'composer-2.5', label: 'Composer 2.5', note: 'balanced default' }],
      roleDefaults: [{ role: 'implementer', model: 'composer-2.5', effort: 'medium' }],
    });

    expect(result.step.model).toBe('composer-2.5');
    expect(result.rejection?.requested).toBe('composer-2.5-fast');
  });

  it('reads a codex key and its cli id as the same pool entry', () => {
    const requested = step({ model: 'gpt-6-astra' });

    const result = enforceOrchestratorModelPool({
      provider: 'codex',
      step: requested,
      pool: [{ id: 'gpt-6', label: 'Astra', note: 'deepest reasoning' }],
      roleDefaults: [{ role: 'implementer', model: 'gpt-6', effort: 'medium' }],
    });

    expect(result.step).toBe(requested);
    expect(result.rejection).toBeNull();
  });

  it('keeps sol, terra and luna apart', () => {
    const result = enforceOrchestratorModelPool({
      provider: 'codex',
      step: step({ model: 'gpt-5.6-luna' }),
      pool: [{ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', note: 'deepest reasoning' }],
      roleDefaults: [{ role: 'implementer', model: 'gpt-5.6-sol', effort: 'medium' }],
    });

    expect(result.step.model).toBe('gpt-5.6-sol');
    expect(result.rejection?.requested).toBe('gpt-5.6-luna');
  });
});

describe('enforceOrchestratorModelPool, ids nobody can resolve', () => {
  it('refuses a model no provider offers', () => {
    const result = enforceOrchestratorModelPool({
      provider: 'anthropic',
      step: step({ model: 'not-a-model' }),
      pool,
      roleDefaults,
    });

    expect(result.step.model).toBe('sonnet-5');
    expect(result.rejection?.requested).toBe('not-a-model');
  });

  it('does not let an unresolvable pool entry stand in for the provider default', () => {
    const result = enforceOrchestratorModelPool({
      provider: 'anthropic',
      step: step({ model: 'opus-5' }),
      pool: [{ id: 'not-a-model', label: 'not a model', note: 'balanced default' }],
      roleDefaults,
    });

    expect(result.step.model).toBe('sonnet-5');
    expect(result.rejection?.requested).toBe('opus-5');
  });
});
