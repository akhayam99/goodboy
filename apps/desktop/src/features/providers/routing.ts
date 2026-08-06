import { getDefaultTurnModel, resolveProvider } from '@goodboy/core';
import type {
  ProviderId,
  RoutingDecision,
  SessionProviderPreference,
  TurnProviderOverride,
} from '@goodboy/types';
import { invokeCheckProviderBudget } from '../budget/budget';

type Params = {
  readonly sessionPreference: SessionProviderPreference;
  readonly turnOverride: TurnProviderOverride | undefined;
  readonly connectedProviders: ProviderId[];
  readonly force?: boolean;
};

export const resolveProviderForTurn = async ({
  sessionPreference,
  turnOverride,
  connectedProviders,
  force,
}: Params): Promise<RoutingDecision> => {
  return resolveProvider({
    sessionPreference,
    turnOverride,
    connectedProviders,
    ...(force === true ? { force: true } : {}),
    budgetChecker: {
      checkProviderBudget: (provider, period) => invokeCheckProviderBudget(provider, period),
    },
    getDefaultModel: (providerId) => getDefaultTurnModel({ id: providerId }),
  });
};
