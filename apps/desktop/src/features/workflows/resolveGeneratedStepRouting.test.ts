// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorkflowRoutingAvailabilitySnapshot } from '@goodboy/core/orchestrator';
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

    expect(routing.pick?.providerOverride).toBe('anthropic');
    expect(routing.pick?.modelOverride).toBe('opus-5');
    expect(routing.pick?.effort).toBe('high');
    expect(routing.pick?.routingDecision.source).toBe('agent');
    expect(routing.taskProfile).toEqual({
      taskType: 'planning',
      difficulty: 'heavy',
      basis: 'agent',
    });
  });

  it('leaves a step that emitted no pick to the candidates at run start', () => {
    const routing = resolveGeneratedStepRouting({
      routing: undefined,
      promptPrefix: 'Review it.',
      emittingProvider: 'anthropic',
      availability: snapshot({ connectedProviders: ['anthropic', 'codex'] }),
    });

    expect(routing.pick).toBeNull();
  });

  it('keeps the stated difficulty of a step that emitted no pick', () => {
    const routing = resolveGeneratedStepRouting({
      routing: { taskType: 'implementation', difficulty: 'heavy' },
      promptPrefix: 'Build it.',
      emittingProvider: 'anthropic',
      availability: snapshot({ connectedProviders: ['anthropic', 'codex'] }),
    });

    expect(routing.pick).toBeNull();
    expect(routing.taskProfile).toEqual({
      taskType: 'implementation',
      difficulty: 'heavy',
      basis: 'agent',
    });
  });

  it('recovers from a pick no catalog can serve instead of dropping routing', () => {
    const routing = resolveGeneratedStepRouting({
      routing: { provider: 'anthropic', model: 'ghost-9', effort: 'high' },
      promptPrefix: 'Build it.',
      emittingProvider: 'anthropic',
      availability: snapshot(),
    });

    expect(routing.pick?.routingDecision.source).toBe('heuristic');
    expect(routing.pick?.routingDecision.adjustment).toBe('unknown_model');
    expect(routing.pick?.modelOverride).not.toBe('ghost-9');
  });

  it('routes nothing when no provider is connected', () => {
    expect(
      resolveGeneratedStepRouting({
        routing: undefined,
        promptPrefix: 'Build it.',
        emittingProvider: 'anthropic',
        availability: snapshot({ connectedProviders: [] }),
      }).pick,
    ).toBeNull();
  });

  it('stores no profile when the agent states none and the text says nothing', () => {
    const routing = resolveGeneratedStepRouting({
      routing: { provider: 'anthropic', model: 'opus-5' },
      promptPrefix: '',
      emittingProvider: 'anthropic',
      availability: snapshot(),
    });

    expect(routing.pick?.modelOverride).toBe('opus-5');
    expect(routing.taskProfile).toBeNull();
  });
});
