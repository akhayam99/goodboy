import type {
  BudgetCheckResult,
  BudgetPeriod,
  ProviderId,
  ProviderName,
  RoutingDecision,
  SessionProviderPreference,
  TurnProviderOverride,
} from '@goodboy/types';

export type ResolveProviderInput = {
  sessionPreference: SessionProviderPreference;
  turnOverride?: TurnProviderOverride;
  connectedProviders: ProviderId[];
  budgetChecker: {
    checkProviderBudget: (
      provider: ProviderName,
      period: BudgetPeriod,
    ) => Promise<BudgetCheckResult>;
  };
  getDefaultModel: (provider: ProviderId) => string;
};

const PROVIDER_ID_TO_NAME: Readonly<Record<ProviderId, ProviderName>> = {
  anthropic: 'anthropic',
  cursor: 'cursor',
  codex: 'openai',
  gemini: 'gemini',
};

export const resolveProvider = async (input: ResolveProviderInput): Promise<RoutingDecision> => {
  const { sessionPreference, turnOverride, connectedProviders, budgetChecker, getDefaultModel } =
    input;

  const useOverride = turnOverride !== undefined && sessionPreference.allowTurnOverride;

  const preferredProvider: ProviderId = useOverride
    ? turnOverride!.providerId
    : sessionPreference.defaultProvider;

  const preferredModel =
    useOverride && turnOverride!.model !== undefined
      ? turnOverride!.model
      : preferredProvider === sessionPreference.defaultProvider
        ? (sessionPreference.defaultModel ?? getDefaultModel(preferredProvider))
        : getDefaultModel(preferredProvider);

  const preferredName = PROVIDER_ID_TO_NAME[preferredProvider];
  const preferredConnected = connectedProviders.includes(preferredProvider);
  const preferredResult = await budgetChecker.checkProviderBudget(preferredName, 'monthly');

  if (preferredConnected && !preferredResult.exceeded) {
    return {
      selectedProvider: preferredProvider,
      selectedModel: preferredModel,
      reason: useOverride ? 'override' : 'preferred',
      fallbackUsed: false,
    };
  }

  for (const candidate of connectedProviders) {
    if (candidate === preferredProvider) {
      continue;
    }

    const candidateName = PROVIDER_ID_TO_NAME[candidate];
    const candidateResult = await budgetChecker.checkProviderBudget(candidateName, 'monthly');

    if (!candidateResult.exceeded) {
      return {
        selectedProvider: candidate,
        selectedModel: getDefaultModel(candidate),
        reason: preferredConnected ? 'fallback-budget' : 'fallback-disconnected',
        fallbackUsed: true,
        fallbackFrom: preferredProvider,
      };
    }
  }

  if (!preferredConnected) {
    return {
      selectedProvider: preferredProvider,
      selectedModel: preferredModel,
      reason: useOverride ? 'override' : 'preferred',
      fallbackUsed: false,
    };
  }

  return {
    selectedProvider: preferredProvider,
    selectedModel: preferredModel,
    reason: 'all-exceeded',
    fallbackUsed: false,
  };
};
