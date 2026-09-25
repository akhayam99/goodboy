import { useEffect, useRef, useState } from 'react';
import {
  PROVIDER_CAPABILITIES,
  modelIdForSelection,
  resolveStoredModelSelection,
  clampEffortForModel,
} from '@goodboy/core';
import { resolveLimitedTaskModel } from '../../../../../store/slices/providerLimits/resolveLimitedTaskModel';
import type { EffortLevel, ProviderId, SessionId, WorkflowRun } from '@goodboy/types';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { AUTO_RECOMMENDATION_COPY } from '../../../../../shared/components/RoutingPicker/autoRecommendationCopy';
import { autoLimitReason } from '../../../../../shared/components/RoutingPicker/autoLimitReason';
import { useAutoLimitContext } from '../../../../providers/hooks/useAutoLimitContext';
import { useAppStore } from '../../../../../store/store';
import { selectResolvedSettings } from '../../../../../store/slices/overrides/selectResolvedSettings';
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

const providerModelId = ({ provider, model }: ProviderModelParams): string => {
  const stored = resolveStoredModelSelection({ provider, id: model });
  return stored.report?.kind === 'unknown'
    ? model
    : modelIdForSelection({ provider, selection: stored.selection });
};

export const OrchestratorRoutingRow = ({ sessionId, run, disabled }: Props) => {
  const session = useAppStore((state) =>
    state.sessions.find((current) => current.id === sessionId),
  );
  const providers = useAppStore((state) => state.providers);
  const taskModels = useAppStore(
    (state) => selectResolvedSettings({ state, sessionId })?.taskModels ?? undefined,
  );
  const workspaceDefaultProviderId = useAppStore(
    (state) => selectResolvedSettings({ state, sessionId })?.defaultProviderOverride ?? undefined,
  );
  const setWorkflowOrchestratorRouting = useAppStore(
    (state) => state.setWorkflowOrchestratorRouting,
  );
  const defaultProvider = (session?.providerOverride ??
    session?.providerPreference.defaultProvider ??
    'anthropic') as ProviderId;
  const limitContext = useAutoLimitContext();
  const automatic = resolveLimitedTaskModel({
    limitContext,
    task: 'workflow_orchestrator',
    preferences: taskModels,
    workspaceDefaultProviderId,
    sessionDefaultProviderId: defaultProvider,
  });
  const pinned =
    run.orchestratorRouting != null && isRoutingModelKnown(run.orchestratorRouting)
      ? run.orchestratorRouting
      : null;
  const preferredProviderId = pinned?.providerId ?? automatic.providerId;
  const [providerId, setProviderId] = useState<ProviderId>(preferredProviderId);
  const pendingProvider = useRef<ProviderId>(preferredProviderId);
  const model = pinned?.model ?? '';
  const routingFor = ({ provider }: ProviderRoutingParams) =>
    provider === automatic.providerId
      ? automatic
      : resolveLimitedTaskModel({
          limitContext: null,
          task: 'workflow_orchestrator',
          preferences: null,
          workspaceDefaultProviderId: provider,
          sessionDefaultProviderId: defaultProvider,
        });
  const recommendedModel = routingFor({ provider: providerId }).model;
  const effortModel = providerModelId({
    provider: providerId,
    model: model === '' ? recommendedModel : model,
  });
  const pendingModel = useRef<string>(effortModel);
  const effortValue = pinned?.effort ?? automatic.effort ?? DEFAULT_EFFORT;
  const connectedProviders = providers
    .filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id)
    .filter((candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0);

  useEffect(() => {
    setProviderId(preferredProviderId);
    pendingProvider.current = preferredProviderId;
  }, [preferredProviderId]);

  useEffect(() => {
    pendingModel.current = effortModel;
  }, [effortModel]);

  const apply = ({ providerId: nextProvider, model: nextModel, effort }: ApplyParams) => {
    const resolved = providerModelId({ provider: nextProvider, model: nextModel });
    pendingProvider.current = nextProvider;
    pendingModel.current = resolved;
    void setWorkflowOrchestratorRouting(sessionId, run.id, {
      providerId: nextProvider,
      model: resolved,
      ...(effort != null && { effort }),
    });
  };

  return (
    <div
      data-testid="orchestrator-routing"
      className="flex min-w-0 shrink-0 items-center text-2xs text-muted-foreground"
    >
      <RoutingPicker
        ariaLabel="Orchestrator routing"
        variant="pill"
        connectedProviders={connectedProviders}
        provider={providerId}
        model={model}
        effort={{
          editable: true,
          value: clampEffortForModel({ model: effortModel, effort: effortValue }) ?? effortValue,
          onChange: (effort) => {
            const nextModel = pendingModel.current;
            const applied = clampEffortForModel({ model: nextModel, effort });
            apply({
              providerId: pendingProvider.current,
              model: nextModel,
              ...(applied != null && { effort: applied }),
            });
          },
        }}
        recommendation={{
          provider: automatic.providerId,
          model: automatic.model,
          ...AUTO_RECOMMENDATION_COPY,
          reason: autoLimitReason({
            defaultProvider: workspaceDefaultProviderId ?? defaultProvider,
            pickedProvider: automatic.providerId,
            atLimit: limitContext?.atLimit ?? [],
          }),
        }}
        disabled={disabled}
        overridden={pinned != null}
        defaultSummary={`${automatic.providerId} ${automatic.model}`}
        onReset={() => void setWorkflowOrchestratorRouting(sessionId, run.id, null)}
        onProvider={(next) => {
          if (next === '') {
            return;
          }
          setProviderId(next);
          pendingProvider.current = next;
          if (pinned == null) {
            return;
          }
          apply(routingFor({ provider: next }));
        }}
        onModel={(nextModel) => {
          if (nextModel === '') {
            void setWorkflowOrchestratorRouting(sessionId, run.id, null);
            return;
          }
          const carried =
            pinned?.effort == null
              ? null
              : clampEffortForModel({ model: nextModel, effort: pinned.effort });
          apply({
            providerId: pendingProvider.current,
            model: nextModel,
            ...(carried != null && { effort: carried }),
          });
        }}
      />
    </div>
  );
};
