import {
  resolveModelForProvider,
  resolveStoredModelSelection,
  type AutoModelChoice,
} from '@goodboy/core';
import type {
  EffortLevel,
  ModelSelection,
  ProviderId,
  RoutingDecision,
  TurnProviderOverride,
} from '@goodboy/types';

type Params = {
  readonly provider: ProviderId;
  readonly routingDecision: RoutingDecision;
  readonly phaseModelOverride: string | null;
  readonly phaseProviderOverride: ProviderId | null;
  readonly autoStepModel: AutoModelChoice | null;
  readonly turnOverride: TurnProviderOverride | undefined;
  readonly agentModelPin: string | null;
  readonly agentProvider: ProviderId | null;
  readonly requestedEffort: EffortLevel | undefined;
};

type Candidate = {
  readonly provider: ProviderId;
  readonly id: string;
  readonly selection?: ModelSelection;
};

export const resolveTurnModelSelection = ({
  provider,
  routingDecision,
  phaseModelOverride,
  phaseProviderOverride,
  autoStepModel,
  turnOverride,
  agentModelPin,
  agentProvider,
  requestedEffort,
}: Params): ModelSelection => {
  const agentModelApplies =
    agentModelPin != null &&
    (agentProvider != null ? agentProvider === provider : provider === 'anthropic');
  const candidate: Candidate =
    phaseModelOverride != null
      ? {
          provider: phaseProviderOverride ?? provider,
          id: phaseModelOverride,
        }
      : autoStepModel != null
        ? {
            provider: autoStepModel.provider,
            id: autoStepModel.model,
          }
        : turnOverride != null
          ? {
              provider: turnOverride.providerId,
              id:
                turnOverride.model ?? turnOverride.selection?.key ?? routingDecision.selectedModel,
              ...(turnOverride.selection != null && { selection: turnOverride.selection }),
            }
          : agentModelApplies
            ? {
                provider: agentProvider ?? provider,
                id: agentModelPin,
              }
            : {
                provider,
                id: routingDecision.selectedModel,
              };
  const shouldUseRoutingDefault =
    routingDecision.fallbackUsed || candidate.provider !== routingDecision.selectedProvider;
  const selectedCandidate: Candidate = shouldUseRoutingDefault
    ? {
        provider,
        id: routingDecision.selectedModel,
      }
    : candidate;
  const mappedId = resolveModelForProvider({
    provider,
    modelId: selectedCandidate.id,
  });
  const normalized = resolveStoredModelSelection({
    provider,
    id: selectedCandidate.selection?.key ?? selectedCandidate.id,
    ...(requestedEffort != null && { effort: requestedEffort }),
  });
  const baseSelection =
    normalized.report?.kind === 'unknown'
      ? resolveStoredModelSelection({
          provider,
          id: mappedId,
          ...(requestedEffort != null && { effort: requestedEffort }),
        }).selection
      : normalized.selection;
  if (selectedCandidate.selection == null || normalized.report?.kind === 'unknown') {
    return baseSelection;
  }
  return {
    ...selectedCandidate.selection,
    key: baseSelection.key,
    ...(requestedEffort != null && { effort: requestedEffort }),
  };
};
