import type {
  BudgetCheckResult,
  BudgetPeriod,
  ProviderId,
  ProviderName,
  RoutingDecision,
  TaskProviderPreference,
  TurnProviderOverride,
} from '@kay-am/types';

export type ResolveProviderInput = {
  sessionPreference: TaskProviderPreference;
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
  opencode: 'opencode',
};

export async function resolveProvider(input: ResolveProviderInput): Promise<RoutingDecision> {
  const { sessionPreference, turnOverride, connectedProviders, budgetChecker, getDefaultModel } =
    input;

  const useOverride = turnOverride !== undefined && sessionPreference.allowTurnOverride;

  const preferredProvider: ProviderId = useOverride
    ? turnOverride!.providerId
    : sessionPreference.defaultProvider;

  const preferredModel =
    useOverride && turnOverride!.model !== undefined
      ? turnOverride!.model
      : (sessionPreference.defaultModel ?? getDefaultModel(preferredProvider));

  const preferredName = PROVIDER_ID_TO_NAME[preferredProvider];
  const preferredResult = await budgetChecker.checkProviderBudget(preferredName, 'monthly');

  if (!preferredResult.exceeded) {
    return {
      selectedProvider: preferredProvider,
      selectedModel: preferredModel,
      reason: useOverride ? 'override' : 'preferred',
      fallbackUsed: false,
    };
  }

  for (const candidate of connectedProviders) {
    if (candidate === preferredProvider) continue;

    const candidateName = PROVIDER_ID_TO_NAME[candidate];
    const candidateResult = await budgetChecker.checkProviderBudget(candidateName, 'monthly');

    if (!candidateResult.exceeded) {
      return {
        selectedProvider: candidate,
        selectedModel: getDefaultModel(candidate),
        reason: 'fallback-budget',
        fallbackUsed: true,
        fallbackFrom: preferredProvider,
      };
    }
  }

  return {
    selectedProvider: preferredProvider,
    selectedModel: preferredModel,
    reason: 'all-exceeded',
    fallbackUsed: false,
  };
}
