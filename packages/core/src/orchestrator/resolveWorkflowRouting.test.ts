import { describe, expect, it } from 'vitest';
import type { WorkflowModelPick, WorkflowRoutingLock, WorkflowTaskProfile } from '@goodboy/types';
import type { WorkflowRoutingProposalParseOutcome } from './parseWorkflowRoutingProposal';
import { resolveWorkflowRouting } from './resolveWorkflowRouting';
import type { WorkflowRoutingResolution } from './resolveWorkflowRouting';
import type { WorkflowRoutingAvailabilitySnapshot } from './workflowRoutingAvailability';

type ResolveParams = Parameters<typeof resolveWorkflowRouting>[0];

const PROFILE: WorkflowTaskProfile = {
  taskType: 'implementation',
  difficulty: 'standard',
  basis: 'agent',
};

const snapshot = (
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

const pick = (
  provider: WorkflowModelPick['provider'],
  model: string,
  effort: WorkflowModelPick['effort'] = null,
): WorkflowModelPick => ({ provider, model, effort });

const lock = (selection: WorkflowModelPick): WorkflowRoutingLock => ({
  version: 1,
  pick: selection,
  origin: 'user',
});

const emitted = (selection: WorkflowModelPick): WorkflowRoutingProposalParseOutcome => ({
  kind: 'valid',
  proposal: {
    pick: selection,
    reason: 'The agent chose this model.',
    source: 'agent',
    profile: PROFILE,
  },
});

const resolve = (overrides: Partial<ResolveParams> = {}): WorkflowRoutingResolution =>
  resolveWorkflowRouting({
    agentLock: null,
    stepLock: null,
    runRoleLock: null,
    proposal: { kind: 'missing', profile: PROFILE },
    roleDefault: null,
    sessionDefault: null,
    kindDefault: null,
    availability: snapshot(),
    contextEstimate: null,
    missingProposal: 'configured_default',
    ...overrides,
  });

const ready = (result: WorkflowRoutingResolution) => {
  if (result.kind !== 'ready') {
    throw new Error(`expected a ready resolution, got ${result.cause}`);
  }
  return result.decision;
};

const blocked = (result: WorkflowRoutingResolution) => {
  if (result.kind !== 'blocked') {
    throw new Error('expected a blocked resolution');
  }
  return result;
};

describe('resolveWorkflowRouting precedence', () => {
  it('puts the run instance lock above the run role lock', () => {
    const decision = ready(
      resolve({
        agentLock: lock(pick('anthropic', 'opus-5')),
        runRoleLock: pick('codex', 'gpt-5.6-sol'),
        proposal: emitted(pick('codex', 'gpt-6')),
      }),
    );

    expect(decision.source).toBe('step_lock');
    expect(decision.selected.model).toBe('opus-5');
  });

  it('falls to the template step lock when the run instance has none', () => {
    const decision = ready(
      resolve({
        stepLock: lock(pick('anthropic', 'sonnet-5')),
        runRoleLock: pick('codex', 'gpt-5.6-sol'),
      }),
    );

    expect(decision.source).toBe('step_lock');
    expect(decision.selected.model).toBe('sonnet-5');
  });

  it('puts the run role lock above the emitted pick', () => {
    const decision = ready(
      resolve({
        runRoleLock: pick('anthropic', 'sonnet-5'),
        proposal: emitted(pick('codex', 'gpt-5.6-sol')),
      }),
    );

    expect(decision.source).toBe('run_role_lock');
    expect(decision.selected.model).toBe('sonnet-5');
  });

  it('puts the emitted pick above the configured role default', () => {
    const decision = ready(
      resolve({
        proposal: emitted(pick('codex', 'gpt-5.6-sol')),
        roleDefault: pick('anthropic', 'opus-5'),
      }),
    );

    expect(decision.source).toBe('agent');
    expect(decision.selected).toEqual({ provider: 'codex', model: 'gpt-5.6-sol', effort: 'low' });
  });

  it('puts the configured role default above the session default', () => {
    const decision = ready(
      resolve({
        roleDefault: pick('anthropic', 'opus-5'),
        sessionDefault: pick('codex', 'gpt-5.6-sol'),
      }),
    );

    expect(decision.source).toBe('role_default');
    expect(decision.selected.model).toBe('opus-5');
  });

  it('puts the session default above the static kind default', () => {
    const decision = ready(
      resolve({
        sessionDefault: pick('anthropic', 'opus-5'),
        kindDefault: pick('codex', 'gpt-5.6-sol'),
      }),
    );

    expect(decision.source).toBe('session_default');
    expect(decision.selected.model).toBe('opus-5');
  });

  it('reaches the static kind default when nothing above it is configured', () => {
    const decision = ready(resolve({ kindDefault: pick('codex', 'gpt-5.6-sol') }));

    expect(decision.source).toBe('kind_default');
  });

  it('blocks rather than inventing a default for a node with nothing configured', () => {
    const result = blocked(resolve({}));

    expect(result.cause).toBe('no_available_model');
  });

  it('keeps the emitted proposal on the decision and leaves execution unrecorded', () => {
    const decision = ready(resolve({ proposal: emitted(pick('anthropic', 'opus-5')) }));

    expect(decision.proposal?.pick.model).toBe('opus-5');
    expect(decision.executed).toBeNull();
    expect(decision.version).toBe(1);
  });
});

describe('resolveWorkflowRouting locks and availability', () => {
  it('blocks an unavailable lock instead of substituting another model', () => {
    const result = blocked(
      resolve({
        agentLock: lock(pick('anthropic', 'opus-5')),
        roleDefault: pick('codex', 'gpt-5.6-sol'),
        availability: snapshot({ connectedProviders: ['codex'] }),
      }),
    );

    expect(result.cause).toBe('unavailable_lock');
    expect(result.reason).toContain('anthropic/opus-5');
  });

  it('blocks a lock naming a model this build does not know', () => {
    const result = blocked(resolve({ agentLock: lock(pick('anthropic', 'not-a-model')) }));

    expect(result.cause).toBe('unavailable_lock');
  });

  it('blocks a budget blocked lock as a lock, so the user can reset it', () => {
    const result = blocked(
      resolve({
        agentLock: lock(pick('anthropic', 'opus-5')),
        availability: snapshot({ budgetBlockedProviders: ['anthropic'] }),
      }),
    );

    expect(result.cause).toBe('unavailable_lock');
  });

  it('blocks a cooling down run role lock rather than rerouting it', () => {
    const result = blocked(
      resolve({
        runRoleLock: pick('anthropic', 'opus-5'),
        proposal: emitted(pick('codex', 'gpt-5.6-sol')),
        availability: snapshot({ coolingDownProviders: ['anthropic'] }),
      }),
    );

    expect(result.cause).toBe('unavailable_lock');
  });

  it('replaces an unavailable emitted pick with the recommendation, not the role default', () => {
    const decision = ready(
      resolve({
        proposal: emitted(pick('anthropic', 'opus-5')),
        roleDefault: pick('codex', 'gpt-5.6-sol'),
        availability: snapshot({ connectedProviders: ['codex'] }),
      }),
    );

    expect(decision.source).toBe('heuristic');
    expect(decision.adjustment).toBe('disconnected');
    expect(decision.selected.provider).toBe('codex');
    expect(decision.proposal?.pick.model).toBe('opus-5');
  });

  it('does not treat an invalid emitted pick as an omitted pick', () => {
    const decision = ready(
      resolve({
        proposal: {
          kind: 'invalid',
          requested: { provider: 'acme', model: 'ghost', effort: null },
          reason: 'Unknown routing provider: acme.',
          profile: PROFILE,
        },
        roleDefault: pick('anthropic', 'opus-5'),
      }),
    );

    expect(decision.source).toBe('heuristic');
    expect(decision.adjustment).toBe('unknown_model');
    expect(decision.proposal).toBeNull();
  });

  it('recovers onto a provider with no curated routing profile', () => {
    const decision = ready(
      resolve({
        proposal: emitted(pick('anthropic', 'opus-5')),
        availability: snapshot({ connectedProviders: ['codex'] }),
      }),
    );

    expect(decision.selected.provider).toBe('codex');
  });

  it('blocks on budget when no catalog model at all can run', () => {
    const result = blocked(
      resolve({
        proposal: emitted(pick('anthropic', 'opus-5')),
        availability: snapshot({ isSessionBudgetBlocked: true }),
      }),
    );

    expect(result.cause).toBe('budget');
  });

  it('never lets a workspace role preference block like a lock', () => {
    const decision = ready(
      resolve({
        roleDefault: pick('anthropic', 'opus-5'),
        sessionDefault: pick('codex', 'gpt-5.6-sol'),
        availability: snapshot({ connectedProviders: ['codex'] }),
      }),
    );

    expect(decision.source).toBe('session_default');
  });

  it('keeps the advisory recommendation out of the no pick fallback path', () => {
    const result = blocked(
      resolve({
        roleDefault: pick('anthropic', 'opus-5'),
        availability: snapshot({ connectedProviders: ['codex'] }),
      }),
    );

    expect(result.cause).toBe('no_available_model');
  });
});

describe('resolveWorkflowRouting effort', () => {
  it('takes the winning model default when the pick names no effort', () => {
    const decision = ready(resolve({ proposal: emitted(pick('anthropic', 'opus-5')) }));

    expect(decision.selected.effort).toBe('high');
    expect(decision.adjustment).toBe('none');
  });

  it('normalizes an unsupported automatic effort against the winning model', () => {
    const decision = ready(resolve({ proposal: emitted(pick('anthropic', 'sonnet-5', 'max')) }));

    expect(decision.selected.effort).toBe('high');
    expect(decision.adjustment).toBe('unsupported_effort');
  });

  it('gives a model with no effort control a null effort', () => {
    const decision = ready(resolve({ proposal: emitted(pick('anthropic', 'haiku-4.5')) }));

    expect(decision.selected.effort).toBeNull();
  });

  it('drops an automatic effort aimed at a model with no effort control', () => {
    const decision = ready(resolve({ proposal: emitted(pick('anthropic', 'haiku-4.5', 'high')) }));

    expect(decision.selected.effort).toBeNull();
    expect(decision.adjustment).toBe('unsupported_effort');
  });

  it('rejects a lock whose effort the locked model does not support', () => {
    const result = blocked(resolve({ agentLock: lock(pick('anthropic', 'sonnet-5', 'max')) }));

    expect(result.cause).toBe('unavailable_lock');
    expect(result.reason).toContain('max');
  });

  it('rejects a lock that asks for effort on a model with no effort control', () => {
    const result = blocked(resolve({ agentLock: lock(pick('anthropic', 'haiku-4.5', 'low')) }));

    expect(result.cause).toBe('unavailable_lock');
  });

  it('fills a lock with no effort from the locked model default', () => {
    const decision = ready(resolve({ agentLock: lock(pick('anthropic', 'opus-5')) }));

    expect(decision.selected.effort).toBe('high');
    expect(decision.adjustment).toBe('none');
  });

  it('normalizes effort against the winning provider, never the losing one', () => {
    const decision = ready(
      resolve({
        runRoleLock: pick('anthropic', 'sonnet-5'),
        proposal: emitted(pick('codex', 'gpt-5.6-sol', 'max')),
      }),
    );

    expect(decision.selected).toEqual({
      provider: 'anthropic',
      model: 'sonnet-5',
      effort: 'medium',
    });
  });

  it('normalizes an unsupported effort on a configured fallback', () => {
    const decision = ready(resolve({ sessionDefault: pick('anthropic', 'sonnet-5', 'max') }));

    expect(decision.selected.effort).toBe('high');
    expect(decision.adjustment).toBe('unsupported_effort');
  });
  it('gives a node under the deterministic rule a pick of its own, not a configured default', () => {
    const decision = ready(
      resolve({
        missingProposal: 'deterministic_pick',
        roleDefault: pick('anthropic', 'opus-5', 'high'),
        kindDefault: pick('anthropic', 'sonnet-5', 'medium'),
      }),
    );

    expect(decision.source).toBe('heuristic');
    expect(decision.selected.model).not.toBe('opus-5');
    expect(decision.proposal).toBeNull();
  });

  it('keeps a lock above the deterministic rule', () => {
    const decision = ready(
      resolve({
        missingProposal: 'deterministic_pick',
        agentLock: lock(pick('codex', 'gpt-5.6-sol', 'high')),
      }),
    );

    expect(decision.source).toBe('step_lock');
    expect(decision.selected.model).toBe('gpt-5.6-sol');
  });

  it('blocks the deterministic rule when nothing is available', () => {
    const result = blocked(
      resolve({
        missingProposal: 'deterministic_pick',
        availability: snapshot({ connectedProviders: [] }),
      }),
    );

    expect(result.cause).toBe('no_available_model');
  });
});
