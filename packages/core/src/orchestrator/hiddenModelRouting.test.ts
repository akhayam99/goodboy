import { describe, expect, it } from 'vitest';
import type { WorkflowModelPick, WorkflowRoutingLock, WorkflowTaskProfile } from '@goodboy/types';
import type { HiddenModels } from '../providers/modelVisibility';
import { orchestratorModelPool } from './orchestratorModelPool';
import type { WorkflowRoutingProposalParseOutcome } from './parseWorkflowRoutingProposal';
import { recommendWorkflowRoutingDecision } from './recommendWorkflowRoutingDecision';
import { resolveWorkflowRouting } from './resolveWorkflowRouting';
import type { WorkflowRoutingResolution } from './resolveWorkflowRouting';
import { workflowRoutingAvailability } from './workflowRoutingAvailability';
import type { WorkflowRoutingAvailabilitySnapshot } from './workflowRoutingAvailability';

type ResolveParams = Parameters<typeof resolveWorkflowRouting>[0];

const OWNER_HIDDEN: HiddenModels = {
  anthropic: ['opus-4.7', 'sonnet-4.5', 'opus-5', 'fable-5', 'sonnet-4.6', 'haiku-4.5', 'sonnet-5'],
  cursor: ['opus-4.7', 'opus-5', 'fable-5', 'sonnet-4.6'],
  codex: ['gpt-5.5'],
};

const PROFILE: WorkflowTaskProfile = {
  taskType: 'review',
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
  hiddenModels: OWNER_HIDDEN,
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
    reason: 'Critical cross-file review needs deep reasoning.',
    source: 'agent',
    profile: PROFILE,
  },
});

const resolve = (overrides: Partial<ResolveParams> = {}): WorkflowRoutingResolution =>
  resolveWorkflowRouting({
    agentLock: null,
    stepLock: null,
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

describe('a model the owner hid is not picked by the orchestrator path', () => {
  it('replaces an orchestrator pick of a hidden model with an allowed one (the Opus 5 row)', () => {
    const decision = ready(resolve({ proposal: emitted(pick('anthropic', 'opus-5', 'high')) }));

    expect(decision.adjustment).toBe('hidden');
    expect(decision.source).toBe('heuristic');
    expect(decision.proposal?.pick.model).toBe('opus-5');
    expect(decision.selected.model).not.toBe('opus-5');
    expect(
      workflowRoutingAvailability({ pick: decision.selected, snapshot: snapshot() }).kind,
    ).toBe('available');
  });

  it('keeps the same orchestrator pick when the model is not hidden', () => {
    const decision = ready(resolve({ proposal: emitted(pick('anthropic', 'opus-5', 'high')) }));
    const open = ready(
      resolve({
        proposal: emitted(pick('anthropic', 'opus-5', 'high')),
        availability: snapshot({ hiddenModels: null }),
      }),
    );

    expect(open.selected.model).toBe('opus-5');
    expect(open.adjustment).toBe('none');
    expect(decision.selected.model).not.toBe(open.selected.model);
  });

  it('never recovers onto a hidden model in any provider', () => {
    const decision = ready(resolve({ proposal: emitted(pick('anthropic', 'opus-5', 'high')) }));
    const hiddenKeys = OWNER_HIDDEN[decision.selected.provider] ?? [];

    expect(hiddenKeys).not.toContain(decision.selected.model);
  });

  it('blocks with an inline reason when only a hidden kind default is configured', () => {
    const result = blocked(resolve({ kindDefault: pick('anthropic', 'opus-5', 'high') }));

    expect(result.reason).toContain('Models you hid are never used automatically.');
  });

  it('picks a hidden model when the owner set it as the role default', () => {
    const decision = ready(resolve({ roleDefault: pick('anthropic', 'opus-5', 'high') }));

    expect(decision.source).toBe('role_default');
    expect(decision.selected.model).toBe('opus-5');
  });

  it('picks a hidden model when the owner set it as the session default', () => {
    const decision = ready(resolve({ sessionDefault: pick('anthropic', 'opus-5', 'high') }));

    expect(decision.source).toBe('session_default');
    expect(decision.selected.model).toBe('opus-5');
  });

  it('keeps a hand lock on a hidden model', () => {
    const decision = ready(resolve({ agentLock: lock(pick('anthropic', 'opus-5', 'high')) }));

    expect(decision.source).toBe('step_lock');
    expect(decision.selected.model).toBe('opus-5');
  });

  it('keeps a hand lock on a hidden model even when a proposal exists', () => {
    const decision = ready(
      resolve({
        stepLock: lock(pick('anthropic', 'sonnet-5', 'medium')),
        proposal: emitted(pick('codex', 'gpt-5.6-sol')),
      }),
    );

    expect(decision.selected.model).toBe('sonnet-5');
  });

  it('blocks inline when every connected model is hidden', () => {
    const everyModel: HiddenModels = {
      anthropic: [
        'opus-4.6',
        'opus-4.7',
        'opus-4.8',
        'opus-5',
        'opus-5.5',
        'fable-5',
        'fable-5.1',
        'sonnet-4.5',
        'sonnet-4.6',
        'sonnet-5',
        'sonnet-5.5',
        'haiku-4.5',
      ],
    };
    const result = blocked(
      resolve({
        proposal: emitted(pick('anthropic', 'opus-5', 'high')),
        availability: snapshot({ connectedProviders: ['anthropic'], hiddenModels: everyModel }),
      }),
    );

    expect(result.cause).toBe('no_available_model');
    expect(result.reason).toContain('Models you hid are never used automatically.');
  });

  it('keeps a hidden model out of the deterministic pick', () => {
    const decision = ready(
      resolve({
        proposal: { kind: 'missing', profile: PROFILE },
        missingProposal: 'deterministic_pick',
      }),
    );

    expect(OWNER_HIDDEN[decision.selected.provider] ?? []).not.toContain(decision.selected.model);
  });
});

describe('availability of a hidden model', () => {
  it('is unavailable for an automatic pick and available for an explicit one', () => {
    const hiddenPick = pick('anthropic', 'opus-5');

    expect(workflowRoutingAvailability({ pick: hiddenPick, snapshot: snapshot() })).toEqual({
      kind: 'unavailable',
      cause: 'hidden',
    });
    expect(
      workflowRoutingAvailability({ pick: hiddenPick, snapshot: snapshot(), isExplicit: true }),
    ).toEqual({ kind: 'available' });
  });

  it('ignores the hidden list when the snapshot carries none', () => {
    expect(
      workflowRoutingAvailability({
        pick: pick('anthropic', 'opus-5'),
        snapshot: snapshot({ hiddenModels: null }),
      }),
    ).toEqual({ kind: 'available' });
  });
});

describe('orchestrator model pool', () => {
  it('leaves hidden models out of the menu the orchestrator sees', () => {
    const pool = orchestratorModelPool({ availability: snapshot(), hidden: OWNER_HIDDEN });
    const identities = pool.map((option) => `${option.provider}/${option.model}`);

    expect(identities).not.toContain('anthropic/opus-5');
    expect(identities).not.toContain('anthropic/sonnet-5');
    expect(identities).toContain('anthropic/opus-5.5');
  });

  it('leaves them out when only the snapshot carries the hidden list', () => {
    const pool = orchestratorModelPool({ availability: snapshot(), hidden: null });
    const identities = pool.map((option) => `${option.provider}/${option.model}`);

    expect(identities).not.toContain('anthropic/opus-5');
  });
});

describe('generated step routing', () => {
  it('never recommends a hidden model', () => {
    const decision = recommendWorkflowRoutingDecision({
      profile: PROFILE,
      proposal: null,
      availability: snapshot(),
      contextEstimate: null,
    });

    expect(decision).not.toBeNull();
    expect(OWNER_HIDDEN[decision?.selected.provider ?? 'anthropic'] ?? []).not.toContain(
      decision?.selected.model,
    );
  });
});
