import { describe, expect, it } from 'vitest';
import type { Step } from '@goodboy/types';
import { agentRowRouting } from './agentRowRouting';

const STEP: Step = JSON.parse(
  JSON.stringify({
    id: 'step-1',
    workflowId: 'workflow-1',
    ordinal: 0,
    name: 'Build',
    promptPrefix: '',
    role: 'implementer',
    providerOverride: 'anthropic',
    modelOverride: 'claude-sonnet-4-5',
    effort: 'medium',
  }),
);

const BASE = {
  roleModels: null,
  providerOverride: null,
  modelOverride: null,
  effortOverride: null,
  sessionProvider: null,
  sessionEffort: null,
} as const;

describe('agentRowRouting', () => {
  it('shows the planned step routing until the step runs', () => {
    const routing = agentRowRouting({ ...BASE, executed: null, step: STEP, kind: 'implementer' });

    expect(routing).toMatchObject({
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      effort: 'medium',
      isPlanned: true,
    });
  });

  it('shows what ran and keeps the plan to name a divergence', () => {
    const routing = agentRowRouting({
      ...BASE,
      executed: { provider: 'openai', model: 'gpt-5' },
      step: STEP,
      kind: 'implementer',
    });

    expect(routing.model).toBe('gpt-5');
    expect(routing.planned).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-5' });
    expect(routing.isPlanned).toBe(false);
  });

  it('reads an agent outside a workflow from its own overrides', () => {
    const routing = agentRowRouting({
      ...BASE,
      executed: null,
      step: null,
      kind: 'generic',
      modelOverride: 'claude-opus-4-5',
      effortOverride: 'high',
    });

    expect(routing).toMatchObject({
      model: 'claude-opus-4-5',
      effort: 'high',
      planned: { provider: null, model: 'claude-opus-4-5' },
      isPlanned: true,
    });
  });

  it('draws nothing it does not know for a fresh agent outside a workflow', () => {
    const routing = agentRowRouting({ ...BASE, executed: null, step: null, kind: 'generic' });

    expect(routing.model).toBeNull();
    expect(routing.planned).toBeNull();
  });
});
