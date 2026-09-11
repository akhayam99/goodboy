import { describe, expect, it } from 'vitest';
import type { WorkflowRoutingAvailabilitySnapshot } from '@goodboy/core';
import type { Step, StepId, WorkflowId } from '@goodboy/types';
import { revalidateStepRouting } from './revalidateStepRouting';

const availability = (
  overrides: Partial<WorkflowRoutingAvailabilitySnapshot> = {},
): WorkflowRoutingAvailabilitySnapshot => ({
  connectedProviders: ['anthropic', 'codex'],
  coolingDownProviders: [],
  budgetBlockedProviders: [],
  isSessionBudgetBlocked: false,
  isRunBudgetBlocked: false,
  nowMs: 0,
  ...overrides,
});

const step = (patch: Partial<Step> = {}): Step =>
  ({
    id: 's-1' as StepId,
    workflowId: 'wf-1' as WorkflowId,
    ordinal: 0,
    name: 'Implement',
    role: 'implementer',
    promptPrefix: '',
    providerOverride: 'codex',
    modelOverride: 'gpt-5.6-sol',
    effort: 'high',
    routingDecision: {
      version: 1,
      proposal: null,
      selected: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
      source: 'agent',
      reason: 'The refactor needs deep reasoning.',
      adjustment: 'none',
      executed: null,
    },
    ...patch,
  }) as Step;

describe('revalidateStepRouting', () => {
  it('leaves a still available selection untouched', () => {
    expect(revalidateStepRouting({ step: step(), availability: availability() })).toBe(null);
  });

  it('leaves a step with no decision to the older routing path', () => {
    const bare = { ...step(), routingDecision: null } as Step;

    expect(revalidateStepRouting({ step: bare, availability: availability() })).toBe(null);
  });

  it('moves a selection off a provider that started cooling down', () => {
    const result = revalidateStepRouting({
      step: step(),
      availability: availability({ coolingDownProviders: ['codex'] }),
    });

    expect(result?.decision.adjustment).toBe('cooldown');
    expect(result?.decision.selected.provider).toBe('anthropic');
    expect(result?.step.providerOverride).toBe('anthropic');
    expect(result?.step.modelOverride).toBe(result?.decision.selected.model);
  });

  it('never substitutes a model for a node the user locked', () => {
    const locked = {
      ...step(),
      routingLock: {
        version: 1,
        pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
        origin: 'user',
      },
    } as Step;

    expect(
      revalidateStepRouting({
        step: locked,
        availability: availability({ coolingDownProviders: ['codex'] }),
      }),
    ).toBe(null);
  });

  it('keeps the step as it stands when nothing at all can run', () => {
    expect(
      revalidateStepRouting({
        step: step(),
        availability: availability({ isSessionBudgetBlocked: true }),
      }),
    ).toBe(null);
  });
});
