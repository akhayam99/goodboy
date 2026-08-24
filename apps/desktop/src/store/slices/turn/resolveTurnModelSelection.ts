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
import { agentPinApplies } from './agentPinApplies';

type Params = {
  readonly provider: ProviderId;
  readonly routingDecision: RoutingDecision;
  readonly retryModel: string | null;
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
  readonly roleAware?: boolean;
};

export const resolveTurnModelSelection = ({
  provider,
  routingDecision,
  retryModel,
  phaseModelOverride,
  phaseProviderOverride,
  autoStepModel,
  turnOverride,
  agentModelPin,
  agentProvider,
  requestedEffort,
}: Params): ModelSelection => {
  const applicableAgentModelPin = agentPinApplies({
    agentModelPin,
    agentProvider,
    provider,
  })
    ? agentModelPin
    : null;
  const turnCandidate: Candidate | null =
    turnOverride == null
      ? null
      : {
          provider: turnOverride.providerId,
          id: turnOverride.model ?? turnOverride.selection?.key ?? routingDecision.selectedModel,
          ...(turnOverride.selection != null && { selection: turnOverride.selection }),
        };
  const candidate: Candidate =
    retryModel != null
      ? { provider, id: retryModel }
      : turnCandidate != null && turnOverride?.explicit === true
        ? turnCandidate
        : phaseModelOverride != null
          ? {
              provider: phaseProviderOverride ?? provider,
              id: phaseModelOverride,
            }
          : autoStepModel != null
            ? {
                provider: autoStepModel.provider,
                id: autoStepModel.model,
                roleAware: true,
              }
            : turnCandidate != null
              ? turnCandidate
              : applicableAgentModelPin != null
                ? {
                    provider: agentProvider ?? provider,
                    id: applicableAgentModelPin,
                  }
                : {
                    provider,
                    id: routingDecision.selectedModel,
                  };
  const shouldUseRoutingDefault =
    retryModel == null &&
    (candidate.provider !== routingDecision.selectedProvider ||
      (routingDecision.fallbackUsed && candidate.roleAware !== true));
  const selectedCandidate: Candidate = shouldUseRoutingDefault
    ? {
        provider,
        id: routingDecision.selectedModel,
      }
    : candidate;
  const preservedEffort = requestedEffort ?? candidate.selection?.effort;
  const mappedId = resolveModelForProvider({
    provider,
    modelId: selectedCandidate.id,
  });
  const normalized = resolveStoredModelSelection({
    provider,
    id: selectedCandidate.selection?.key ?? selectedCandidate.id,
    ...(preservedEffort != null && { effort: preservedEffort }),
  });
  const baseSelection =
    normalized.report?.kind === 'unknown'
      ? resolveStoredModelSelection({
          provider,
          id: mappedId,
          ...(preservedEffort != null && { effort: preservedEffort }),
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
