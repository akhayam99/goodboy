import { getDefaultTurnModel, resolveProvider } from '@goodboy/core'
import type {
  ProviderId,
  RoutingDecision,
  SessionProviderPreference,
  TurnProviderOverride,
} from '@goodboy/types'
import { invokeCheckProviderBudget } from '../budget/budget'

export const resolveProviderForTurn = async (
  sessionPreference: SessionProviderPreference,
  turnOverride: TurnProviderOverride | undefined,
  connectedProviders: ProviderId[],
): Promise<RoutingDecision> => {
  return resolveProvider({
    sessionPreference,
    turnOverride,
    connectedProviders,
    budgetChecker: {
      checkProviderBudget: (provider, period) => invokeCheckProviderBudget(provider, period),
    },
    getDefaultModel: (providerId) => getDefaultTurnModel(providerId),
  })
}
