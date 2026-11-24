// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorkflowRoutingWireFields } from '@goodboy/core/orchestrator';
import type { CandidateInputs } from '@goodboy/core/providers';
import type { AgentRole } from '@goodboy/types';
import { resolveOrchestratedStepRouting } from './resolveOrchestratedStepRouting';
import type { RoutedPick } from './writerFamilyOf';

const INPUTS: CandidateInputs = {
  defaultProvider: 'anthropic',
  connected: ['anthropic', 'codex'],
  policy: [
    { id: 'anthropic', state: 'on' },
    { id: 'codex', state: 'on' },
  ],
  rule: 'order',
};

type RouteParams = {
  readonly fields: WorkflowRoutingWireFields;
  readonly isModelPickEnabled: boolean;
  readonly role?: AgentRole;
  readonly earlier?: ReadonlyArray<RoutedPick>;
};

const route = ({ fields, isModelPickEnabled, role = 'implementer', earlier = [] }: RouteParams) =>
  resolveOrchestratedStepRouting({
    inputs: INPUTS,
    role,
    fields: { difficulty: 'standard', ...fields },
    isModelPickEnabled,
    promptText: 'Retry the failed settlements in ledger-core.',
    emittingProvider: 'anthropic',
    earlier,
  }).decision;

describe('resolveOrchestratedStepRouting', () => {
  it('takes the best candidate by the rule while the model pick rule is off', () => {
    expect(
      route({ fields: { provider: 'codex', model: 'gpt-6.1-sol' }, isModelPickEnabled: false }),
    ).toMatchObject({
      proposal: null,
      selected: { provider: 'anthropic', model: 'sonnet-5.5' },
      source: 'kind_default',
      reason: 'Claude: first in your order',
      adjustment: 'none',
    });
  });

  it('keeps a pick from a row and its own line', () => {
    expect(
      route({
        fields: {
          provider: 'codex',
          model: 'gpt-6.1-sol',
          effort: 'high',
          modelReason: 'Codex has the most room for a long refactor.',
        },
        isModelPickEnabled: true,
      }),
    ).toMatchObject({
      selected: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
      source: 'agent',
      reason: 'Codex has the most room for a long refactor.',
      adjustment: 'none',
    });
  });

  it('moves a pick that is not a row to the best one and says why', () => {
    expect(
      route({ fields: { provider: 'anthropic', model: 'fable-5' }, isModelPickEnabled: true }),
    ).toMatchObject({
      selected: { provider: 'anthropic', model: 'sonnet-5.5' },
      source: 'kind_default',
      reason: 'Claude Fable 5: not a candidate for this step. Claude: first in your order.',
      adjustment: 'unknown_model',
    });
  });

  it('names a model this build does not know', () => {
    expect(route({ fields: { model: 'gpt-9-imaginary' }, isModelPickEnabled: true })).toMatchObject(
      {
        selected: { provider: 'anthropic' },
        adjustment: 'unknown_model',
      },
    );
  });

  it('starts a reviewer on another model family than the step that wrote the change', () => {
    expect(
      route({
        fields: {},
        isModelPickEnabled: false,
        role: 'reviewer',
        earlier: [{ role: 'implementer', provider: 'anthropic', model: 'sonnet-5.5' }],
      }),
    ).toMatchObject({ selected: { provider: 'codex' } });
  });
});
