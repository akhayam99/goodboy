import { getDefaultTurnModel, resolveProvider } from '@goodboy/core';
import type {
  ProviderId,
  RoutingDecision,
  SessionProviderPreference,
  TurnProviderOverride,
} from '@goodboy/types';
import { invokeCheckProviderBudget } from '../budget/budget';

export type ProviderCooldowns = Readonly<Partial<Record<ProviderId, number>>>;

type Params = {
  readonly sessionPreference: SessionProviderPreference;
  readonly turnOverride: TurnProviderOverride | undefined;
  readonly connectedProviders: ProviderId[];
  readonly cooldowns?: ProviderCooldowns;
  readonly force?: boolean;
};

export const resolveProviderForTurn = async ({
  sessionPreference,
  turnOverride,
  connectedProviders,
  cooldowns,
  force,
}: Params): Promise<RoutingDecision> => {
  return resolveProvider({
    sessionPreference,
    turnOverride,
    connectedProviders,
    ...(force === true ? { force: true } : {}),
    cooldownChecker: {
      isProviderCoolingDown: (providerId) => {
        const until = cooldowns?.[providerId];
        return until !== undefined && until > Date.now();
      },
    },
    budgetChecker: {
      checkProviderBudget: (provider, period) => invokeCheckProviderBudget(provider, period),
    },
    getDefaultModel: (providerId) => getDefaultTurnModel({ id: providerId }),
  });
};
