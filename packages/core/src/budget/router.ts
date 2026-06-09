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

  // Preferred is usable only when it's connected AND within budget.
  if (preferredConnected && !preferredResult.exceeded) {
    return {
      selectedProvider: preferredProvider,
      selectedModel: preferredModel,
      reason: useOverride ? 'override' : 'preferred',
      fallbackUsed: false,
    };
  }

  // Fall back to a connected provider within budget. Disconnection of the
  // preferred provider triggers a fallback too, not just budget: a
  // disconnected-but-under-budget preferred used to be selected anyway and the
  // turn then failed downstream.
  for (const candidate of connectedProviders) {
    if (candidate === preferredProvider) continue;

    const candidateName = PROVIDER_ID_TO_NAME[candidate];
    const candidateResult = await budgetChecker.checkProviderBudget(candidateName, 'monthly');

    if (!candidateResult.exceeded) {
      return {
        selectedProvider: candidate,
        selectedModel: getDefaultModel(candidate),
        // Disconnection takes precedence over budget as the labeled cause.
        reason: preferredConnected ? 'fallback-budget' : 'fallback-disconnected',
        fallbackUsed: true,
        fallbackFrom: preferredProvider,
      };
    }
  }

  // No usable fallback. If the preferred is only disconnected (not over budget),
  // hand it back unchanged so the caller's auth-required flow can prompt a
  // reconnect; reporting 'all-exceeded' here would show a misleading budget
  // message.
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
