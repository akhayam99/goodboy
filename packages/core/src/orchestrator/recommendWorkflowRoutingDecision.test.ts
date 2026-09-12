import { describe, expect, it } from 'vitest';
import type { WorkflowTaskProfile } from '@goodboy/types';
import { WORKFLOW_ROUTING_REASON_LIMIT, cappedRoutingReason } from './parseWorkflowRoutingProposal';
import { recommendWorkflowRoutingDecision } from './recommendWorkflowRoutingDecision';
import type { WorkflowRoutingAvailabilitySnapshot } from './workflowRoutingAvailability';

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

const profile: WorkflowTaskProfile = {
  taskType: 'implementation',
  difficulty: 'standard',
  basis: 'heuristic',
};

describe('recommendWorkflowRoutingDecision', () => {
  it('builds a heuristic decision over the available catalog', () => {
    const decision = recommendWorkflowRoutingDecision({
      availability: snapshot(),
      profile,
      proposal: null,
      contextEstimate: null,
    });

    expect(decision?.source).toBe('heuristic');
    expect(decision?.selected.provider).toBe('anthropic');
    expect(decision?.adjustment).toBe('none');
    expect(decision?.executed).toBeNull();
    expect(decision?.reason).toContain('heuristic estimate');
  });

  it('recommends nothing when no provider is connected', () => {
    const decision = recommendWorkflowRoutingDecision({
      availability: snapshot({ connectedProviders: [] }),
      profile,
      proposal: null,
      contextEstimate: null,
    });

    expect(decision).toBeNull();
  });

  it('caps the reason it stores', () => {
    const decision = recommendWorkflowRoutingDecision({
      availability: snapshot(),
      profile,
      proposal: null,
      contextEstimate: null,
    });
    if (decision === null) {
      throw new Error('expected a decision to cap the reason of');
    }
    const oversized = 'x'.repeat(WORKFLOW_ROUTING_REASON_LIMIT + 37);

    expect(decision.reason.length).toBeGreaterThan(0);
    expect(decision.reason.length).toBeLessThanOrEqual(WORKFLOW_ROUTING_REASON_LIMIT);
    expect(cappedRoutingReason(oversized)).toBe('x'.repeat(WORKFLOW_ROUTING_REASON_LIMIT));
    expect(cappedRoutingReason(oversized).length).toBe(WORKFLOW_ROUTING_REASON_LIMIT);
  });
});
