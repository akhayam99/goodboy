import {
  PROVIDER_CAPABILITIES,
  modelIdForSelection,
  resolveStoredModelSelection,
  clampEffortForModel,
  type ResolveSlot,
} from '@goodboy/core';
import type { EffortLevel, ProviderId, SessionId, WorkflowRun } from '@goodboy/types';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { savedRouteEffort } from '../../../../../shared/components/RoutingPicker/savedRouteEffort';
import { AUTO_RECOMMENDATION_COPY } from '../../../../../shared/components/RoutingPicker/autoRecommendationCopy';
import { autoLimitReason } from '../../../../../shared/components/RoutingPicker/autoLimitReason';
import { useResolution } from '../../../../providers/hooks/useResolution';
import { autoModelOn } from '../../../../providers/autoModelOn';
import { resolutionAsTask } from '../../../../providers/resolutionAsTask';
import { useAppStore } from '../../../../../store/store';
import { isRoutingModelKnown } from '../../../../../store/slices/workflows/orchestrateNextStep';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly disabled: boolean;
};

type ApplyParams = {
  readonly providerId: ProviderId;
  readonly model: string;
  readonly effort?: EffortLevel;
};

type ProviderRoutingParams = {
  readonly provider: ProviderId;
};

type ProviderModelParams = {
  readonly provider: ProviderId;
  readonly model: string;
};

const DEFAULT_EFFORT: EffortLevel = 'medium';

const ORCHESTRATOR_SLOT: ResolveSlot = { kind: 'task', id: 'workflow_orchestrator' };

const providerModelId = ({ provider, model }: ProviderModelParams): string => {
  const stored = resolveStoredModelSelection({ provider, id: model });
  return stored.report?.kind === 'unknown'
    ? model
    : modelIdForSelection({ provider, selection: stored.selection });
};

export const OrchestratorRoutingRow = ({ sessionId, run, disabled }: Props) => {
  const providers = useAppStore((state) => state.providers);
  const setWorkflowOrchestratorRouting = useAppStore(
    (state) => state.setWorkflowOrchestratorRouting,
  );
  const resolution = useResolution({ task: 'workflow_orchestrator', sessionId });
  const automatic = resolutionAsTask({ resolution });
  const pinned =
    run.orchestratorRouting != null && isRoutingModelKnown(run.orchestratorRouting)
      ? run.orchestratorRouting
      : null;
  const providerId = pinned?.providerId ?? automatic.providerId;
  const model = pinned?.model ?? '';
  const recommendedModel =
    providerId === automatic.providerId
      ? automatic.model
      : autoModelOn({ slot: ORCHESTRATOR_SLOT, provider: providerId }).model;
  const effortModel = providerModelId({
    provider: providerId,
    model: model === '' ? recommendedModel : model,
  });
  const effortValue = pinned?.effort ?? automatic.effort ?? DEFAULT_EFFORT;
  const shownEffort =
    clampEffortForModel({ model: effortModel, effort: effortValue, provider: providerId }) ??
    effortValue;
  const connectedProviders = providers
    .filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id)
    .filter((candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0);

  const apply = ({ providerId: nextProvider, model: nextModel, effort }: ApplyParams) => {
    const resolved = providerModelId({ provider: nextProvider, model: nextModel });
    void setWorkflowOrchestratorRouting(sessionId, run.id, {
      providerId: nextProvider,
      model: resolved,
      ...(effort != null && { effort }),
    });
  };

  return (
    <div
      data-testid="orchestrator-routing"
      className="flex min-w-0 shrink-0 items-center text-meta text-muted-foreground"
    >
      <RoutingPicker
        ariaLabel="Orchestrator routing"
        variant="pill"
        connectedProviders={connectedProviders}
        provider={providerId}
        model={model}
        effort={{ editable: true, value: shownEffort }}
        recommendation={{
          provider: automatic.providerId,
          model: automatic.model,
          ...AUTO_RECOMMENDATION_COPY,
          reason: autoLimitReason({
            defaultProvider: resolution.defaultProvider,
            pickedProvider: automatic.providerId,
            atLimit: resolution.skipped.flatMap((skip) =>
              skip.reason === 'at-limit' ? [skip.provider] : [],
            ),
          }),
        }}
        recommendationKind="auto"
        disabled={disabled}
        overridden={pinned != null}
        defaultSummary={`${automatic.providerId} ${automatic.model}`}
        onReset={() => void setWorkflowOrchestratorRouting(sessionId, run.id, null)}
        hasTriggerReset={false}
        onChange={(route) => {
          if (route.provider === '') {
            return;
          }
          const effort = savedRouteEffort({
            route,
            requested: effortValue,
            wasSaved: pinned?.effort != null,
          });
          apply({
            providerId: route.provider,
            model: route.model,
            ...(effort != null && { effort }),
          });
        }}
      />
    </div>
  );
};
