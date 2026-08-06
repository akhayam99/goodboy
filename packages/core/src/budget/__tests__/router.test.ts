import { describe, it, expect, vi } from 'vitest';
import { resolveProvider } from '../router';
import type { ResolveProviderInput } from '../router';
import type { BudgetCheckResult } from '@goodboy/types';

function notExceeded(overrides: Partial<BudgetCheckResult> = {}): BudgetCheckResult {
  return { remainingUsd: 100, pct: 50, exceeded: false, overThreshold: false, ...overrides };
}

function exceeded(): BudgetCheckResult {
  return { remainingUsd: -1, pct: 101, exceeded: true, overThreshold: false };
}

function overThreshold(): BudgetCheckResult {
  return { remainingUsd: 15, pct: 85, exceeded: false, overThreshold: true };
}

function makeInput(overrides: Partial<ResolveProviderInput> = {}): ResolveProviderInput {
  return {
    sessionPreference: {
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-5-sonnet',
      allowTurnOverride: true,
    },
    connectedProviders: ['anthropic', 'cursor'],
    budgetChecker: {
      checkProviderBudget: vi.fn().mockResolvedValue(notExceeded()),
    },
    getDefaultModel: (p) => `default-model-${p}`,
    ...overrides,
  };
}

describe('resolveProvider', () => {
  it('preferred provider not exceeded → returns preferred with reason preferred', async () => {
    const input = makeInput();
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.reason).toBe('preferred');
    expect(decision.fallbackUsed).toBe(false);
  });

  it('turn override provided and allowed → returns override with reason override', async () => {
    const input = makeInput({
      turnOverride: { providerId: 'cursor', model: 'cursor-fast' },
      sessionPreference: {
        defaultProvider: 'anthropic',
        allowTurnOverride: true,
      },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('cursor');
    expect(decision.selectedModel).toBe('cursor-fast');
    expect(decision.reason).toBe('override');
    expect(decision.fallbackUsed).toBe(false);
  });

  it('turn override provided but not allowed → uses session default', async () => {
    const input = makeInput({
      turnOverride: { providerId: 'cursor', model: 'cursor-fast' },
      sessionPreference: {
        defaultProvider: 'anthropic',
        defaultModel: 'claude-3-5-sonnet',
        allowTurnOverride: false,
      },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.reason).toBe('preferred');
  });

  it('preferred exceeded, fallback available → returns fallback with reason fallback-budget', async () => {
    const checkMock = vi
      .fn()
      .mockResolvedValueOnce(exceeded())
      .mockResolvedValueOnce(notExceeded());

    const input = makeInput({
      budgetChecker: { checkProviderBudget: checkMock },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('cursor');
    expect(decision.reason).toBe('fallback-budget');
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.fallbackFrom).toBe('anthropic');
  });

  it('all providers exceeded → returns preferred with reason all-exceeded', async () => {
    const checkMock = vi.fn().mockResolvedValue(exceeded());

    const input = makeInput({
      budgetChecker: { checkProviderBudget: checkMock },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.reason).toBe('all-exceeded');
    expect(decision.fallbackUsed).toBe(false);
  });

  it('all providers exceeded with force → returns preferred with reason forced-over-budget', async () => {
    const checkMock = vi.fn().mockResolvedValue(exceeded());

    const input = makeInput({
      budgetChecker: { checkProviderBudget: checkMock },
      force: true,
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.selectedModel).toBe('claude-3-5-sonnet');
    expect(decision.reason).toBe('forced-over-budget');
    expect(decision.fallbackUsed).toBe(false);
  });

  it('force keeps the turn override provider when everything is over cap', async () => {
    const checkMock = vi.fn().mockResolvedValue(exceeded());

    const input = makeInput({
      turnOverride: { providerId: 'cursor', model: 'composer-2.5' },
      budgetChecker: { checkProviderBudget: checkMock },
      force: true,
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('cursor');
    expect(decision.selectedModel).toBe('composer-2.5');
    expect(decision.reason).toBe('forced-over-budget');
  });

  it('force does not change a decision that was never all-exceeded', async () => {
    const input = makeInput({ force: true });
    const decision = await resolveProvider(input);

    expect(decision.reason).toBe('preferred');
    expect(decision.selectedProvider).toBe('anthropic');
  });

  it('only one connected provider → no fallback, returns all-exceeded when over', async () => {
    const checkMock = vi.fn().mockResolvedValue(exceeded());

    const input = makeInput({
      connectedProviders: ['anthropic'],
      budgetChecker: { checkProviderBudget: checkMock },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.reason).toBe('all-exceeded');
    expect(decision.fallbackUsed).toBe(false);
    expect(decision.fallbackFrom).toBeUndefined();
  });

  it('preferred disconnected but a connected provider is within budget → fallback-disconnected', async () => {
    const input = makeInput({
      connectedProviders: ['cursor'],
      budgetChecker: { checkProviderBudget: vi.fn().mockResolvedValue(notExceeded()) },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('cursor');
    expect(decision.reason).toBe('fallback-disconnected');
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.fallbackFrom).toBe('anthropic');
  });

  it('preferred disconnected with no connected provider → returns preferred for the auth flow', async () => {
    const input = makeInput({
      connectedProviders: [],
      budgetChecker: { checkProviderBudget: vi.fn().mockResolvedValue(notExceeded()) },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.reason).toBe('preferred');
    expect(decision.fallbackUsed).toBe(false);
  });

  it('preferred disconnected and the only fallback is over budget → returns preferred, not all-exceeded', async () => {
    const checkMock = vi.fn(async (provider: string) =>
      provider === 'cursor' ? exceeded() : notExceeded(),
    );
    const input = makeInput({
      connectedProviders: ['cursor'],
      budgetChecker: { checkProviderBudget: checkMock },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.reason).toBe('preferred');
    expect(decision.fallbackUsed).toBe(false);
  });
});

describe('resolveProvider, budget threshold tier', () => {
  it('preferred past its threshold and a candidate is clear → moves with reason fallback-threshold', async () => {
    const checkMock = vi.fn(async (provider: string) =>
      provider === 'anthropic' ? overThreshold() : notExceeded(),
    );
    const input = makeInput({
      budgetChecker: { checkProviderBudget: checkMock },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('cursor');
    expect(decision.reason).toBe('fallback-threshold');
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.fallbackFrom).toBe('anthropic');
  });

  it('preferred past its threshold and every candidate is too → stays put, no fallback', async () => {
    const checkMock = vi.fn().mockResolvedValue(overThreshold());
    const input = makeInput({
      connectedProviders: ['anthropic', 'cursor', 'gemini'],
      budgetChecker: { checkProviderBudget: checkMock },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.reason).toBe('preferred');
    expect(decision.fallbackUsed).toBe(false);
  });

  it('preferred past its threshold with no other provider connected → stays put', async () => {
    const checkMock = vi.fn().mockResolvedValue(overThreshold());
    const input = makeInput({
      connectedProviders: ['anthropic'],
      budgetChecker: { checkProviderBudget: checkMock },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.reason).toBe('preferred');
    expect(decision.fallbackUsed).toBe(false);
  });

  it('a clear provider beats one that is past its threshold', async () => {
    const checkMock = vi.fn(async (provider: string) => {
      if (provider === 'anthropic') {
        return overThreshold();
      }
      return provider === 'openai' ? overThreshold() : notExceeded();
    });
    const input = makeInput({
      connectedProviders: ['anthropic', 'codex', 'gemini'],
      budgetChecker: { checkProviderBudget: checkMock },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('gemini');
    expect(decision.reason).toBe('fallback-threshold');
  });

  it('preferred over cap → a past-threshold provider is still accepted, reason fallback-budget', async () => {
    const checkMock = vi.fn(async (provider: string) =>
      provider === 'anthropic' ? exceeded() : overThreshold(),
    );
    const input = makeInput({
      budgetChecker: { checkProviderBudget: checkMock },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('cursor');
    expect(decision.reason).toBe('fallback-budget');
    expect(decision.fallbackUsed).toBe(true);
  });

  it('over cap still blocks: a past-threshold preferred never yields all-exceeded', async () => {
    const checkMock = vi.fn().mockResolvedValue(overThreshold());
    const input = makeInput({
      connectedProviders: ['anthropic'],
      budgetChecker: { checkProviderBudget: checkMock },
    });
    const decision = await resolveProvider(input);

    expect(decision.reason).not.toBe('all-exceeded');
  });

  it('preferred disconnected and past its threshold → reason stays fallback-disconnected', async () => {
    const checkMock = vi.fn(async (provider: string) =>
      provider === 'anthropic' ? overThreshold() : notExceeded(),
    );
    const input = makeInput({
      connectedProviders: ['cursor'],
      budgetChecker: { checkProviderBudget: checkMock },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('cursor');
    expect(decision.reason).toBe('fallback-disconnected');
  });

  it('a turn override past its threshold still moves, keeping the threshold reason', async () => {
    const checkMock = vi.fn(async (provider: string) =>
      provider === 'openai' ? overThreshold() : notExceeded(),
    );
    const input = makeInput({
      connectedProviders: ['anthropic', 'codex'],
      turnOverride: { providerId: 'codex', model: 'gpt-5' },
      budgetChecker: { checkProviderBudget: checkMock },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.reason).toBe('fallback-threshold');
    expect(decision.fallbackFrom).toBe('codex');
  });
});

describe('resolveProvider, enabledProviders gate', () => {
  it('empty enabledProviders behaves as all-enabled (preferred wins)', async () => {
    const input = makeInput({
      sessionPreference: {
        defaultProvider: 'anthropic',
        defaultModel: 'claude-3-5-sonnet',
        allowTurnOverride: true,
        enabledProviders: [],
      },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.reason).toBe('preferred');
  });

  it('preferred enabled and within budget → preferred, even with a narrowed set', async () => {
    const input = makeInput({
      sessionPreference: {
        defaultProvider: 'anthropic',
        allowTurnOverride: true,
        enabledProviders: ['anthropic'],
      },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.reason).toBe('preferred');
    expect(decision.fallbackUsed).toBe(false);
  });

  it('preferred disabled → routes to an enabled connected provider', async () => {
    const input = makeInput({
      connectedProviders: ['anthropic', 'cursor'],
      sessionPreference: {
        defaultProvider: 'anthropic',
        allowTurnOverride: true,
        enabledProviders: ['cursor'],
      },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('cursor');
    expect(decision.reason).toBe('fallback-disconnected');
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.fallbackFrom).toBe('anthropic');
  });

  it('budget fallback skips a connected but disabled provider', async () => {
    const checkMock = vi.fn(async (provider: string) =>
      provider === 'anthropic' ? exceeded() : notExceeded(),
    );
    const input = makeInput({
      connectedProviders: ['anthropic', 'cursor', 'gemini'],
      sessionPreference: {
        defaultProvider: 'anthropic',
        allowTurnOverride: true,
        enabledProviders: ['anthropic', 'gemini'],
      },
      budgetChecker: { checkProviderBudget: checkMock },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('gemini');
    expect(decision.reason).toBe('fallback-budget');
    expect(decision.fallbackFrom).toBe('anthropic');
  });

  it('force never runs on a provider the session disabled', async () => {
    const checkMock = vi.fn(async (provider: string) =>
      provider === 'anthropic' ? notExceeded() : exceeded(),
    );
    const input = makeInput({
      connectedProviders: ['anthropic', 'cursor'],
      sessionPreference: {
        defaultProvider: 'anthropic',
        defaultModel: 'claude-3-5-sonnet',
        allowTurnOverride: true,
        enabledProviders: ['cursor'],
      },
      budgetChecker: { checkProviderBudget: checkMock },
      force: true,
    });
    const decision = await resolveProvider(input);

    expect(decision.reason).toBe('all-exceeded');
  });

  it('turn override bypasses the enabled gate (explicit pin wins)', async () => {
    const input = makeInput({
      connectedProviders: ['anthropic', 'cursor'],
      turnOverride: { providerId: 'cursor', model: 'cursor-fast' },
      sessionPreference: {
        defaultProvider: 'anthropic',
        allowTurnOverride: true,
        enabledProviders: ['anthropic'],
      },
    });
    const decision = await resolveProvider(input);

    expect(decision.selectedProvider).toBe('cursor');
    expect(decision.selectedModel).toBe('cursor-fast');
    expect(decision.reason).toBe('override');
    expect(decision.fallbackUsed).toBe(false);
  });
});
