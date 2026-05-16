import { getDefaultTurnModel, resolveProvider } from '@kay-am/core';
import type {
  ProviderId,
  RoutingDecision,
  SessionProviderPreference,
  TurnProviderOverride,
} from '@kay-am/types';
import { invokeCheckProviderBudget } from '../budget/budget';

export async function resolveProviderForTurn(
  sessionPreference: SessionProviderPreference,
  turnOverride: TurnProviderOverride | undefined,
  connectedProviders: ProviderId[],
): Promise<RoutingDecision> {
  return resolveProvider({
    sessionPreference,
    turnOverride,
    connectedProviders,
    budgetChecker: {
      checkProviderBudget: (provider, period) => invokeCheckProviderBudget(provider, period),
    },
    getDefaultModel: (providerId) => getDefaultTurnModel(providerId),
  });
}
