import type {
  BudgetCheckResult,
  BudgetPeriod,
  ProviderId,
  ProviderName,
  RoutingDecision,
  RoutingReason,
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
  opencode: 'opencode',
  openrouter: 'openrouter',
  moonshot: 'moonshot',
};

export const resolveProvider = async (input: ResolveProviderInput): Promise<RoutingDecision> => {
  const { sessionPreference, turnOverride, connectedProviders, budgetChecker, getDefaultModel } =
    input;

  const useOverride = turnOverride !== undefined && sessionPreference.allowTurnOverride;

  const enabled = sessionPreference.enabledProviders;
  const enabledSet = enabled && enabled.length > 0 ? new Set<ProviderId>(enabled) : null;
  const isEnabled = (provider: ProviderId): boolean =>
    enabledSet === null || enabledSet.has(provider);

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
  const preferredAllowed = useOverride || isEnabled(preferredProvider);
  const preferredResult = await budgetChecker.checkProviderBudget(preferredName, 'monthly');

  const keepPreferred: RoutingDecision = {
    selectedProvider: preferredProvider,
    selectedModel: preferredModel,
    reason: useOverride ? 'override' : 'preferred',
    fallbackUsed: false,
  };

  const preferredUsable = preferredConnected && preferredAllowed && !preferredResult.exceeded;

  if (preferredUsable && !preferredResult.overThreshold) {
    return keepPreferred;
  }

  const movedForThreshold = preferredUsable && preferredResult.overThreshold;
  const budgetReason: RoutingReason = movedForThreshold ? 'fallback-threshold' : 'fallback-budget';
  const fallbackReason: RoutingReason =
    preferredConnected && preferredAllowed ? budgetReason : 'fallback-disconnected';

  const moveTo = (candidate: ProviderId): RoutingDecision => ({
    selectedProvider: candidate,
    selectedModel: getDefaultModel(candidate),
    reason: fallbackReason,
    fallbackUsed: true,
    fallbackFrom: preferredProvider,
  });

  let overThresholdCandidate: ProviderId | null = null;

  for (const candidate of connectedProviders) {
    if (candidate === preferredProvider) {
      continue;
    }
    if (!isEnabled(candidate)) {
      continue;
    }

    const candidateName = PROVIDER_ID_TO_NAME[candidate];
    const candidateResult = await budgetChecker.checkProviderBudget(candidateName, 'monthly');

    if (candidateResult.exceeded) {
      continue;
    }
    if (!candidateResult.overThreshold) {
      return moveTo(candidate);
    }
    if (overThresholdCandidate === null) {
      overThresholdCandidate = candidate;
    }
  }

  if (movedForThreshold) {
    return keepPreferred;
  }

  if (overThresholdCandidate !== null) {
    return moveTo(overThresholdCandidate);
  }

  if (!preferredConnected) {
    return keepPreferred;
  }

  return {
    selectedProvider: preferredProvider,
    selectedModel: preferredModel,
    reason: 'all-exceeded',
    fallbackUsed: false,
  };
};
