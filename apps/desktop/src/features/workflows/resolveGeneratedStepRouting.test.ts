import { describe, expect, it } from 'vitest';
import type { WorkflowRoutingAvailabilitySnapshot } from '@goodboy/core';
import { resolveGeneratedStepRouting } from './resolveGeneratedStepRouting';

const snapshot = (
  overrides: Partial<WorkflowRoutingAvailabilitySnapshot> = {},
): WorkflowRoutingAvailabilitySnapshot => ({
  connectedProviders: ['anthropic'],
  coolingDownProviders: [],
  budgetBlockedProviders: [],
  isSessionBudgetBlocked: false,
  isRunBudgetBlocked: false,
  nowMs: 0,
  ...overrides,
});

describe('resolveGeneratedStepRouting', () => {
  it('keeps an available emitted pick and the profile the agent stated', () => {
    const routing = resolveGeneratedStepRouting({
      routing: {
        provider: 'anthropic',
        model: 'opus-5',
        effort: 'high',
        taskType: 'planning',
        difficulty: 'heavy',
        modelReason: 'The plan has to reconcile three subsystems.',
      },
      promptPrefix: 'Plan the migration.',
      emittingProvider: 'anthropic',
      availability: snapshot(),
    });

    expect(routing?.providerOverride).toBe('anthropic');
    expect(routing?.modelOverride).toBe('opus-5');
    expect(routing?.effort).toBe('high');
    expect(routing?.routingDecision.source).toBe('agent');
    expect(routing?.taskProfile).toEqual({
      taskType: 'planning',
      difficulty: 'heavy',
      basis: 'agent',
    });
  });

  it('recommends a model for a step that emitted no pick at all', () => {
    const routing = resolveGeneratedStepRouting({
      routing: undefined,
      promptPrefix: 'Review it.',
      emittingProvider: 'anthropic',
      availability: snapshot(),
    });

    expect(routing).not.toBeNull();
    expect(routing?.routingDecision.source).toBe('heuristic');
    expect(routing?.providerOverride).toBe('anthropic');
  });

  it('recovers from a pick no catalog can serve instead of dropping routing', () => {
    const routing = resolveGeneratedStepRouting({
      routing: { provider: 'anthropic', model: 'ghost-9', effort: 'high' },
      promptPrefix: 'Build it.',
      emittingProvider: 'anthropic',
      availability: snapshot(),
    });

    expect(routing?.routingDecision.source).toBe('heuristic');
    expect(routing?.routingDecision.adjustment).toBe('unknown_model');
    expect(routing?.modelOverride).not.toBe('ghost-9');
  });

  it('routes nothing when no provider is connected', () => {
    expect(
      resolveGeneratedStepRouting({
        routing: undefined,
        promptPrefix: 'Build it.',
        emittingProvider: 'anthropic',
        availability: snapshot({ connectedProviders: [] }),
      }),
    ).toBeNull();
  });

  it('stores no profile when neither the agent nor the text says anything', () => {
    const routing = resolveGeneratedStepRouting({
      routing: undefined,
      promptPrefix: '',
      emittingProvider: 'anthropic',
      availability: snapshot(),
    });

    expect(routing?.taskProfile).toBeNull();
  });
});
