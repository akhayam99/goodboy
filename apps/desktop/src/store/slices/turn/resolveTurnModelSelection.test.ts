import { describe, expect, it } from 'vitest';
import type { RoutingDecision } from '@goodboy/types';
import { agentPinApplies } from './agentPinApplies';
import { resolveTurnModelSelection } from './resolveTurnModelSelection';

const ROUTING_DECISION = {
  selectedProvider: 'anthropic',
  selectedModel: 'claude-sonnet-4-5',
  reason: 'preferred',
  fallbackUsed: false,
} satisfies RoutingDecision;

const BASE_PARAMS = {
  provider: 'anthropic',
  routingDecision: ROUTING_DECISION,
  phaseModelOverride: null,
  phaseProviderOverride: null,
  autoStepModel: null,
  turnOverride: undefined,
  agentModelPin: null,
  agentProvider: null,
  requestedEffort: undefined,
} satisfies Parameters<typeof resolveTurnModelSelection>[0];

describe('agentPinApplies', () => {
  it('requires a model pin', () => {
    expect(
      agentPinApplies({
        agentModelPin: null,
        agentProvider: 'anthropic',
        provider: 'anthropic',
      }),
    ).toBe(false);
  });

  it('applies a pin when the agent provider matches the routed provider', () => {
    expect(
      agentPinApplies({
        agentModelPin: 'composer-2.5',
        agentProvider: 'cursor',
        provider: 'cursor',
      }),
    ).toBe(true);
  });

  it('rejects a pin when the agent provider differs from the routed provider', () => {
    expect(
      agentPinApplies({
        agentModelPin: 'composer-2.5',
        agentProvider: 'cursor',
        provider: 'anthropic',
      }),
    ).toBe(false);
  });

  it('treats an unscoped pin as anthropic-only', () => {
    expect(
      agentPinApplies({
        agentModelPin: 'claude-haiku-4-5',
        agentProvider: null,
        provider: 'anthropic',
      }),
    ).toBe(true);
    expect(
      agentPinApplies({
        agentModelPin: 'claude-haiku-4-5',
        agentProvider: null,
        provider: 'cursor',
      }),
    ).toBe(false);
  });
});

describe('resolveTurnModelSelection', () => {
  it('gives the phase override precedence over every other candidate', () => {
    const selection = resolveTurnModelSelection({
      ...BASE_PARAMS,
      phaseModelOverride: 'claude-opus-5',
      autoStepModel: { provider: 'anthropic', model: 'claude-haiku-4-5' },
      turnOverride: { providerId: 'anthropic', model: 'claude-sonnet-4-6' },
      agentModelPin: 'claude-haiku-4-5',
    });

    expect(selection.key).toBe('opus-5');
  });

  it('degrades a phase override scoped to a different provider to the routing default', () => {
    const selection = resolveTurnModelSelection({
      ...BASE_PARAMS,
      phaseModelOverride: 'composer-2.5',
      phaseProviderOverride: 'cursor',
    });

    expect(selection.key).toBe('sonnet-4.5');
  });

  it('gives the auto step model precedence over a turn override', () => {
    const selection = resolveTurnModelSelection({
      ...BASE_PARAMS,
      autoStepModel: { provider: 'anthropic', model: 'claude-haiku-4-5' },
      turnOverride: { providerId: 'anthropic', model: 'claude-opus-5' },
    });

    expect(selection.key).toBe('haiku-4.5');
  });

  it('gives the turn override precedence over an agent pin', () => {
    const selection = resolveTurnModelSelection({
      ...BASE_PARAMS,
      turnOverride: { providerId: 'anthropic', model: 'claude-sonnet-4-6' },
      agentModelPin: 'claude-haiku-4-5',
    });

    expect(selection.key).toBe('sonnet-4.6');
  });

  it('uses an agent pin whose provider matches the routed provider', () => {
    const selection = resolveTurnModelSelection({
      ...BASE_PARAMS,
      provider: 'cursor',
      routingDecision: {
        selectedProvider: 'cursor',
        selectedModel: 'auto',
        reason: 'preferred',
        fallbackUsed: false,
      },
      agentModelPin: 'composer-2.5',
      agentProvider: 'cursor',
    });

    expect(selection.key).toBe('composer-2.5');
  });

  it('uses an unscoped agent pin for the anthropic default case', () => {
    const selection = resolveTurnModelSelection({
      ...BASE_PARAMS,
      agentModelPin: 'claude-haiku-4-5',
    });

    expect(selection.key).toBe('haiku-4.5');
  });

  it('rejects an agent pin that does not apply to the routed provider', () => {
    const selection = resolveTurnModelSelection({
      ...BASE_PARAMS,
      provider: 'cursor',
      routingDecision: {
        selectedProvider: 'cursor',
        selectedModel: 'composer-2.5',
        reason: 'preferred',
        fallbackUsed: false,
      },
      agentModelPin: 'claude-haiku-4-5',
      agentProvider: 'anthropic',
    });

    expect(selection.key).toBe('composer-2.5');
  });

  it('uses the routing default when no override or pin is set', () => {
    const selection = resolveTurnModelSelection(BASE_PARAMS);

    expect(selection.key).toBe('sonnet-4.5');
  });

  it('degrades a matching-provider candidate when routing used a fallback', () => {
    const selection = resolveTurnModelSelection({
      ...BASE_PARAMS,
      routingDecision: {
        ...ROUTING_DECISION,
        fallbackUsed: true,
        fallbackFrom: 'cursor',
      },
      turnOverride: { providerId: 'anthropic', model: 'claude-opus-5' },
    });

    expect(selection.key).toBe('sonnet-4.5');
  });

  it('preserves the requested effort when routing degrades to the fallback model', () => {
    const selection = resolveTurnModelSelection({
      ...BASE_PARAMS,
      routingDecision: {
        ...ROUTING_DECISION,
        fallbackUsed: true,
        fallbackFrom: 'cursor',
      },
      turnOverride: { providerId: 'anthropic', model: 'claude-opus-5' },
      requestedEffort: 'high',
    });

    expect(selection).toEqual({ key: 'sonnet-4.5', effort: 'high' });
  });

  it('carries the discarded override selection effort into the routing default', () => {
    const selection = resolveTurnModelSelection({
      ...BASE_PARAMS,
      turnOverride: {
        providerId: 'cursor',
        selection: { key: 'composer-2.5', effort: 'high' },
      },
    });

    expect(selection).toEqual({ key: 'sonnet-4.5', effort: 'high' });
  });

  it('remaps a foreign phase model id after unknown normalization without throwing', () => {
    const selection = resolveTurnModelSelection({
      ...BASE_PARAMS,
      provider: 'cursor',
      routingDecision: {
        selectedProvider: 'cursor',
        selectedModel: 'composer-2.5',
        reason: 'preferred',
        fallbackUsed: false,
      },
      phaseModelOverride: 'claude-opus-5',
    });

    expect(selection.key).toBe('opus-5');
  });

  it('preserves authored selection axes while re-stamping requested effort', () => {
    const selection = resolveTurnModelSelection({
      ...BASE_PARAMS,
      provider: 'cursor',
      routingDecision: {
        selectedProvider: 'cursor',
        selectedModel: 'auto',
        reason: 'preferred',
        fallbackUsed: false,
      },
      turnOverride: {
        providerId: 'cursor',
        selection: {
          key: 'composer-2.5',
          effort: 'low',
          variant: 'captured',
          toggles: { thinking: false, fast: true },
        },
      },
      requestedEffort: 'xhigh',
    });

    expect(selection).toEqual({
      key: 'composer-2.5',
      effort: 'xhigh',
      variant: 'captured',
      toggles: { thinking: false, fast: true },
    });
  });
});
