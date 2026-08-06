import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoutingDecision, SessionProviderPreference } from '@goodboy/types';

const { resolveProviderMock, checkProviderBudgetMock } = vi.hoisted(() => ({
  resolveProviderMock: vi.fn(),
  checkProviderBudgetMock: vi.fn(),
}));

vi.mock('@goodboy/core', () => ({
  resolveProvider: resolveProviderMock,
  getDefaultTurnModel: () => 'claude-opus-5',
}));

vi.mock('../budget/budget', () => ({
  invokeCheckProviderBudget: checkProviderBudgetMock,
}));

import { resolveProviderForTurn } from './routing';

const DECISION = {
  selectedProvider: 'anthropic',
  selectedModel: 'claude-opus-5',
  reason: 'preferred',
  fallbackUsed: false,
} satisfies RoutingDecision;

const PREFERENCE = {
  defaultProvider: 'anthropic',
  allowTurnOverride: false,
} satisfies SessionProviderPreference;

beforeEach(() => {
  resolveProviderMock.mockReset();
  resolveProviderMock.mockResolvedValue(DECISION);
  checkProviderBudgetMock.mockReset();
});

describe('resolveProviderForTurn', () => {
  it('forwards a forced turn into the budget resolver', async () => {
    await resolveProviderForTurn({
      sessionPreference: PREFERENCE,
      turnOverride: undefined,
      connectedProviders: ['anthropic'],
      force: true,
    });

    expect(resolveProviderMock).toHaveBeenCalledWith(expect.objectContaining({ force: true }));
  });

  it('omits force for a plain turn', async () => {
    await resolveProviderForTurn({
      sessionPreference: PREFERENCE,
      turnOverride: undefined,
      connectedProviders: ['anthropic'],
    });

    expect(resolveProviderMock.mock.calls[0]?.[0]).not.toHaveProperty('force');
  });
});
