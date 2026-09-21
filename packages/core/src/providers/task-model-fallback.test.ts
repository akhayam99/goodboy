import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { getCheapModel } from './cli-defaults';
import { taskModelProviderPool } from './providerFallbackPool';
import { MAX_TASK_MODEL_PROVIDER_ATTEMPTS, planTaskModelFallback } from './task-model-fallback';

const ANTHROPIC_CHEAP = {
  providerId: 'anthropic' as ProviderId,
  model: getCheapModel('anthropic'),
};

type CostTierParams = {
  readonly providerId: ProviderId;
  readonly model: string;
};

const costTierOf = ({ providerId, model }: CostTierParams) =>
  PROVIDER_CAPABILITIES[providerId].models.find((candidate) => candidate.id === model)?.costTier;

describe('taskModelProviderPool', () => {
  it('drops the failed provider, the cooling ones, and anything outside the pool', () => {
    expect(
      taskModelProviderPool({
        provider: 'anthropic',
        connectedProviders: ['anthropic', 'codex', 'gemini', 'cursor'],
        enabledProviders: ['anthropic', 'codex', 'gemini'],
        coolingDownProviders: ['gemini'],
      }),
    ).toEqual(['codex']);
  });

  it('keeps every connected provider when the pool is empty', () => {
    expect(
      taskModelProviderPool({
        provider: 'anthropic',
        connectedProviders: ['anthropic', 'codex', 'gemini'],
        enabledProviders: [],
        coolingDownProviders: ['gemini'],
      }),
    ).toEqual(['codex']);
  });

  it('keeps every connected provider when no pool is configured', () => {
    expect(
      taskModelProviderPool({
        provider: 'anthropic',
        connectedProviders: ['anthropic', 'codex', 'gemini'],
        enabledProviders: null,
        coolingDownProviders: [],
      }),
    ).toEqual(['codex', 'gemini']);
  });
});

describe('planTaskModelFallback', () => {
  it('moves a usage-limited task to an aligned model on another provider', () => {
    const plan = planTaskModelFallback({
      failure: 'usage_limit',
      taskModel: ANTHROPIC_CHEAP,
      attempt: 0,
      connectedProviders: ['anthropic', 'codex'],
      enabledProviders: null,
      coolingDownProviders: [],
    });

    expect(plan?.providerId).toBe('codex');
    expect(costTierOf({ providerId: 'codex', model: plan?.model ?? '' })).toBe('cheap');
  });

  it('moves an authentication failure the same way', () => {
    const plan = planTaskModelFallback({
      failure: 'authentication',
      taskModel: ANTHROPIC_CHEAP,
      attempt: 0,
      connectedProviders: ['anthropic', 'codex'],
      enabledProviders: null,
      coolingDownProviders: [],
    });

    expect(plan?.providerId).toBe('codex');
  });

  it('moves an unavailable model to an allowed alternative provider', () => {
    const plan = planTaskModelFallback({
      failure: 'model_not_available',
      taskModel: ANTHROPIC_CHEAP,
      attempt: 0,
      connectedProviders: ['anthropic', 'codex'],
      enabledProviders: null,
      coolingDownProviders: [],
    });

    expect(plan?.providerId).toBe('codex');
    expect(costTierOf({ providerId: 'codex', model: plan?.model ?? '' })).toBe('cheap');
  });

  it('returns no plan for an unavailable model when the pool is exhausted', () => {
    expect(
      planTaskModelFallback({
        failure: 'model_not_available',
        taskModel: ANTHROPIC_CHEAP,
        attempt: 0,
        connectedProviders: ['anthropic', 'codex'],
        enabledProviders: null,
        coolingDownProviders: ['codex'],
      }),
    ).toBeNull();
  });

  it('returns no plan for an unavailable model when the pool excludes every alternative', () => {
    expect(
      planTaskModelFallback({
        failure: 'model_not_available',
        taskModel: ANTHROPIC_CHEAP,
        attempt: 0,
        connectedProviders: ['anthropic', 'codex'],
        enabledProviders: ['anthropic'],
        coolingDownProviders: [],
      }),
    ).toBeNull();
  });

  it('stops at the attempt ceiling for an unavailable model too', () => {
    expect(
      planTaskModelFallback({
        failure: 'model_not_available',
        taskModel: ANTHROPIC_CHEAP,
        attempt: MAX_TASK_MODEL_PROVIDER_ATTEMPTS,
        connectedProviders: ['anthropic', 'codex', 'gemini'],
        enabledProviders: null,
        coolingDownProviders: [],
      }),
    ).toBeNull();
  });

  it('stops at the attempt ceiling', () => {
    expect(
      planTaskModelFallback({
        failure: 'usage_limit',
        taskModel: ANTHROPIC_CHEAP,
        attempt: 1,
        connectedProviders: ['anthropic', 'codex', 'gemini'],
        enabledProviders: null,
        coolingDownProviders: [],
      }),
    ).toBeNull();
  });

  it('never moves a failure the pool cannot help with', () => {
    expect(
      planTaskModelFallback({
        failure: 'other',
        taskModel: ANTHROPIC_CHEAP,
        attempt: 0,
        connectedProviders: ['anthropic', 'codex'],
        enabledProviders: null,
        coolingDownProviders: [],
      }),
    ).toBeNull();
  });

  it('returns nothing when every other provider is cooling down', () => {
    expect(
      planTaskModelFallback({
        failure: 'usage_limit',
        taskModel: ANTHROPIC_CHEAP,
        attempt: 0,
        connectedProviders: ['anthropic', 'codex'],
        enabledProviders: null,
        coolingDownProviders: ['codex'],
      }),
    ).toBeNull();
  });
});
