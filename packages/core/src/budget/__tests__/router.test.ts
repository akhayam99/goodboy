import { describe, it, expect, vi } from 'vitest'
import { resolveProvider } from '../router'
import type { ResolveProviderInput } from '../router'
import type { BudgetCheckResult } from '@goodboy/types'

function notExceeded(overrides: Partial<BudgetCheckResult> = {}): BudgetCheckResult {
  return { remainingUsd: 100, pct: 50, exceeded: false, ...overrides }
}

function exceeded(): BudgetCheckResult {
  return { remainingUsd: -1, pct: 101, exceeded: true }
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
  }
}

describe('resolveProvider', () => {
  it('preferred provider not exceeded → returns preferred with reason preferred', async () => {
    const input = makeInput()
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('anthropic')
    expect(decision.reason).toBe('preferred')
    expect(decision.fallbackUsed).toBe(false)
  })

  it('turn override provided and allowed → returns override with reason override', async () => {
    const input = makeInput({
      turnOverride: { providerId: 'cursor', model: 'cursor-fast' },
      sessionPreference: {
        defaultProvider: 'anthropic',
        allowTurnOverride: true,
      },
    })
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('cursor')
    expect(decision.selectedModel).toBe('cursor-fast')
    expect(decision.reason).toBe('override')
    expect(decision.fallbackUsed).toBe(false)
  })

  it('turn override provided but not allowed → uses session default', async () => {
    const input = makeInput({
      turnOverride: { providerId: 'cursor', model: 'cursor-fast' },
      sessionPreference: {
        defaultProvider: 'anthropic',
        defaultModel: 'claude-3-5-sonnet',
        allowTurnOverride: false,
      },
    })
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('anthropic')
    expect(decision.reason).toBe('preferred')
  })

  it('preferred exceeded, fallback available → returns fallback with reason fallback-budget', async () => {
    const checkMock = vi.fn().mockResolvedValueOnce(exceeded()).mockResolvedValueOnce(notExceeded())

    const input = makeInput({
      budgetChecker: { checkProviderBudget: checkMock },
    })
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('cursor')
    expect(decision.reason).toBe('fallback-budget')
    expect(decision.fallbackUsed).toBe(true)
    expect(decision.fallbackFrom).toBe('anthropic')
  })

  it('all providers exceeded → returns preferred with reason all-exceeded', async () => {
    const checkMock = vi.fn().mockResolvedValue(exceeded())

    const input = makeInput({
      budgetChecker: { checkProviderBudget: checkMock },
    })
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('anthropic')
    expect(decision.reason).toBe('all-exceeded')
    expect(decision.fallbackUsed).toBe(false)
  })

  it('only one connected provider → no fallback, returns all-exceeded when over', async () => {
    const checkMock = vi.fn().mockResolvedValue(exceeded())

    const input = makeInput({
      connectedProviders: ['anthropic'],
      budgetChecker: { checkProviderBudget: checkMock },
    })
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('anthropic')
    expect(decision.reason).toBe('all-exceeded')
    expect(decision.fallbackUsed).toBe(false)
    expect(decision.fallbackFrom).toBeUndefined()
  })

  it('preferred disconnected but a connected provider is within budget → fallback-disconnected', async () => {
    const input = makeInput({
      connectedProviders: ['cursor'],
      budgetChecker: { checkProviderBudget: vi.fn().mockResolvedValue(notExceeded()) },
    })
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('cursor')
    expect(decision.reason).toBe('fallback-disconnected')
    expect(decision.fallbackUsed).toBe(true)
    expect(decision.fallbackFrom).toBe('anthropic')
  })

  it('preferred disconnected with no connected provider → returns preferred for the auth flow', async () => {
    const input = makeInput({
      connectedProviders: [],
      budgetChecker: { checkProviderBudget: vi.fn().mockResolvedValue(notExceeded()) },
    })
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('anthropic')
    expect(decision.reason).toBe('preferred')
    expect(decision.fallbackUsed).toBe(false)
  })

  it('preferred disconnected and the only fallback is over budget → returns preferred, not all-exceeded', async () => {
    const checkMock = vi.fn(async (provider: string) =>
      provider === 'cursor' ? exceeded() : notExceeded(),
    )
    const input = makeInput({
      connectedProviders: ['cursor'],
      budgetChecker: { checkProviderBudget: checkMock },
    })
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('anthropic')
    expect(decision.reason).toBe('preferred')
    expect(decision.fallbackUsed).toBe(false)
  })
})

describe('resolveProvider, enabledProviders gate', () => {
  it('empty enabledProviders behaves as all-enabled (preferred wins)', async () => {
    const input = makeInput({
      sessionPreference: {
        defaultProvider: 'anthropic',
        defaultModel: 'claude-3-5-sonnet',
        allowTurnOverride: true,
        enabledProviders: [],
      },
    })
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('anthropic')
    expect(decision.reason).toBe('preferred')
  })

  it('preferred enabled and within budget → preferred, even with a narrowed set', async () => {
    const input = makeInput({
      sessionPreference: {
        defaultProvider: 'anthropic',
        allowTurnOverride: true,
        enabledProviders: ['anthropic'],
      },
    })
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('anthropic')
    expect(decision.reason).toBe('preferred')
    expect(decision.fallbackUsed).toBe(false)
  })

  it('preferred disabled → routes to an enabled connected provider', async () => {
    const input = makeInput({
      connectedProviders: ['anthropic', 'cursor'],
      sessionPreference: {
        defaultProvider: 'anthropic',
        allowTurnOverride: true,
        enabledProviders: ['cursor'],
      },
    })
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('cursor')
    expect(decision.reason).toBe('fallback-disconnected')
    expect(decision.fallbackUsed).toBe(true)
    expect(decision.fallbackFrom).toBe('anthropic')
  })

  it('budget fallback skips a connected but disabled provider', async () => {
    const checkMock = vi.fn(async (provider: string) =>
      provider === 'anthropic' ? exceeded() : notExceeded(),
    )
    const input = makeInput({
      connectedProviders: ['anthropic', 'cursor', 'gemini'],
      sessionPreference: {
        defaultProvider: 'anthropic',
        allowTurnOverride: true,
        enabledProviders: ['anthropic', 'gemini'],
      },
      budgetChecker: { checkProviderBudget: checkMock },
    })
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('gemini')
    expect(decision.reason).toBe('fallback-budget')
    expect(decision.fallbackFrom).toBe('anthropic')
  })

  it('turn override bypasses the enabled gate (explicit pin wins)', async () => {
    const input = makeInput({
      connectedProviders: ['anthropic', 'cursor'],
      turnOverride: { providerId: 'cursor', model: 'cursor-fast' },
      sessionPreference: {
        defaultProvider: 'anthropic',
        allowTurnOverride: true,
        enabledProviders: ['anthropic'],
      },
    })
    const decision = await resolveProvider(input)

    expect(decision.selectedProvider).toBe('cursor')
    expect(decision.selectedModel).toBe('cursor-fast')
    expect(decision.reason).toBe('override')
    expect(decision.fallbackUsed).toBe(false)
  })
})
