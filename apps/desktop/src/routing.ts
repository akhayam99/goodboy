import { getDefaultTurnModel, resolveProvider } from '@kay-am/core';
import type {
  ProviderId,
  RoutingDecision,
  TaskProviderPreference,
  TurnProviderOverride,
} from '@kay-am/types';
import { invokeCheckProviderBudget } from './budget';

export async function resolveProviderForTurn(
  sessionPreference: TaskProviderPreference,
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
