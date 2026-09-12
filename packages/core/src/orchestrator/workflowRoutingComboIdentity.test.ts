import type { ModelEffort } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { resolveModelArgs } from '../providers/resolveModelArgs';
import { resolveStoredModelSelection } from '../providers/resolveStoredModelSelection';
import { parseOrchestratorDecision } from './parser';
import { parseWorkflowRoutingProposal } from './parseWorkflowRoutingProposal';
import { resolveWorkflowRouting } from './resolveWorkflowRouting';
import type { WorkflowRoutingAvailabilitySnapshot } from './workflowRoutingAvailability';
import { workflowRoutingAvailability } from './workflowRoutingAvailability';

const availability: WorkflowRoutingAvailabilitySnapshot = {
  connectedProviders: ['cursor'],
  coolingDownProviders: [],
  budgetBlockedProviders: [],
  isSessionBudgetBlocked: false,
  isRunBudgetBlocked: false,
  nowMs: 0,
};

const resolveFromDecision = (raw: string) => {
  const decision = parseOrchestratorDecision({ raw, provider: 'cursor' });
  if (decision === null || decision.action !== 'next') {
    throw new Error('expected a next decision');
  }
  const resolution = resolveWorkflowRouting({
    agentLock: null,
    stepLock: null,
    runRoleLock: null,
    proposal: parseWorkflowRoutingProposal({
      fields: decision.step,
      emittingProvider: 'cursor',
    }),
    roleDefault: null,
    sessionDefault: null,
    kindDefault: null,
    availability,
    contextEstimate: null,
    missingProposal: 'configured_default',
  });
  if (resolution.kind !== 'ready') {
    throw new Error(`expected a ready resolution, got ${resolution.reason}`);
  }
  return resolution.decision;
};

type CliArgsParams = {
  readonly model: string;
  readonly effort: ModelEffort | null;
};

const cliArgsFor = ({ model, effort }: CliArgsParams) =>
  resolveModelArgs({
    provider: 'cursor',
    selection: resolveStoredModelSelection({
      provider: 'cursor',
      id: model,
      ...(effort !== null && { effort }),
    }).selection,
  }).args;

describe('workflow routing, combo identity', () => {
  it('reads a combo the catalog offers as available', () => {
    expect(
      workflowRoutingAvailability({
        pick: { provider: 'cursor', model: 'composer-2.5-fast', effort: null },
        snapshot: availability,
      }),
    ).toEqual({ kind: 'available' });
  });

  it('still refuses a model no catalog offers', () => {
    expect(
      workflowRoutingAvailability({
        pick: { provider: 'cursor', model: 'composer-9000-fast', effort: null },
        snapshot: availability,
      }),
    ).toEqual({ kind: 'unavailable', cause: 'unknown_model' });
  });

  it('keeps an emitted combo in the proposal instead of collapsing it to the base key', () => {
    const outcome = parseWorkflowRoutingProposal({
      fields: { provider: 'cursor', model: 'composer-2.5-fast' },
      emittingProvider: 'cursor',
    });

    if (outcome.kind !== 'valid') {
      throw new Error('expected a valid routing outcome');
    }
    expect(outcome.proposal.pick.model).toBe('composer-2.5-fast');
  });

  it('leaves a plain key plain', () => {
    const outcome = parseWorkflowRoutingProposal({
      fields: { provider: 'cursor', model: 'composer-2.5' },
      emittingProvider: 'cursor',
    });

    if (outcome.kind !== 'valid') {
      throw new Error('expected a valid routing outcome');
    }
    expect(outcome.proposal.pick.model).toBe('composer-2.5');
  });

  it('carries a combo the orchestrator named all the way to the cli arguments', () => {
    const decision = resolveFromDecision(
      '<<orchestrator>>{"action":"next","reason":"x","step":{"name":"Fix","role":"implementer","promptPrefix":"Fix it.","provider":"cursor","model":"composer-2.5-fast"}}<</orchestrator>>',
    );

    expect(decision.selected.model).toBe('composer-2.5-fast');
    expect(decision.adjustment).toBe('none');
    expect(
      cliArgsFor({ model: decision.selected.model, effort: decision.selected.effort }),
    ).toEqual(cliArgsFor({ model: 'composer-2.5-fast', effort: null }));
    expect(
      cliArgsFor({ model: decision.selected.model, effort: decision.selected.effort }),
    ).not.toEqual(cliArgsFor({ model: 'composer-2.5', effort: null }));
  });

  it('keeps the effort a combo supports instead of dropping it as unsupported', () => {
    const decision = resolveFromDecision(
      '<<orchestrator>>{"action":"next","reason":"x","step":{"name":"Plan","role":"planner","promptPrefix":"Plan it.","provider":"cursor","model":"claude-opus-5-thinking-high","effort":"high"}}<</orchestrator>>',
    );

    expect(decision.selected).toEqual({
      provider: 'cursor',
      model: 'claude-opus-5-thinking-high',
      effort: 'high',
    });
    expect(decision.adjustment).toBe('none');
  });
});
