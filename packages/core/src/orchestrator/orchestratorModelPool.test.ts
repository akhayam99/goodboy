import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@goodboy/types';
import { orchestratorModelPool } from './orchestratorModelPool';
import type { WorkflowRoutingAvailabilitySnapshot } from './workflowRoutingAvailability';

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

const identities = (availability: WorkflowRoutingAvailabilitySnapshot): ReadonlyArray<string> =>
  orchestratorModelPool({ availability }).map((option) => `${option.provider}/${option.model}`);

describe('orchestratorModelPool', () => {
  it('includes connected catalog models absent from every role default', () => {
    expect(identities(snapshot())).toContain('anthropic/fable-5');
  });

  it('keeps duplicate model ids distinct across providers', () => {
    const pool = orchestratorModelPool({
      availability: snapshot({ connectedProviders: ['anthropic', 'cursor'] }),
    });
    const shared = pool.filter((option) => option.model === 'opus-5');

    expect(shared.map((option) => option.provider)).toEqual(['anthropic', 'cursor']);
  });

  it.each([
    ['disconnected', snapshot({ connectedProviders: ['anthropic'] })],
    ['cooling', snapshot({ coolingDownProviders: ['codex'] })],
    ['hard blocked', snapshot({ budgetBlockedProviders: ['codex'] })],
  ])('excludes %s providers', (_label, availability) => {
    const providers = new Set<ProviderId>(
      orchestratorModelPool({ availability }).map((option) => option.provider),
    );

    expect(providers.has('codex')).toBe(false);
    expect(providers.has('anthropic')).toBe(true);
  });

  it('offers nothing while a session-wide budget stop holds', () => {
    expect(
      orchestratorModelPool({ availability: snapshot({ isSessionBudgetBlocked: true }) }),
    ).toEqual([]);
  });

  it('carries the catalog label and the efforts each identity accepts', () => {
    const option = orchestratorModelPool({ availability: snapshot() }).find(
      (candidate) => candidate.provider === 'anthropic' && candidate.model === 'sonnet-5',
    );

    expect(option?.label).toBe('Sonnet 5');
    expect(option?.efforts.length).toBeGreaterThan(0);
  });
});
