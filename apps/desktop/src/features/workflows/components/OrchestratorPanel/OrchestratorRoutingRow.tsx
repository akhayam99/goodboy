import { useState } from 'react';
import { PROVIDER_CAPABILITIES, resolveTaskModel } from '@goodboy/core';
import type { ModelEffort, ProviderId, SessionId, WorkflowRun } from '@goodboy/types';
import { clampEffort, modelEffortLevels } from '../../../chat/utils/chat-constants';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { useAppStore } from '../../../../store/store';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly disabled: boolean;
};

const DEFAULT_EFFORT: ModelEffort = 'medium';

const effortForModel = (model: string, requested: ModelEffort): ModelEffort | null =>
  modelEffortLevels(model) == null ? null : clampEffort(model, requested);

export const OrchestratorRoutingRow = ({ sessionId, run, disabled }: Props) => {
  const session = useAppStore((state) =>
    state.sessions.find((current) => current.id === sessionId),
  );
  const providers = useAppStore((state) => state.providers);
  const taskModels = useAppStore((state) =>
    session == null ? undefined : state.workspaceOverrides?.[session.workspaceId]?.taskModels,
  );
  const setWorkflowOrchestratorRouting = useAppStore(
    (state) => state.setWorkflowOrchestratorRouting,
  );
  const defaultProvider = (session?.providerOverride ??
    session?.providerPreference.defaultProvider ??
    'anthropic') as ProviderId;
  const automatic = resolveTaskModel('workflow_orchestrator', taskModels, defaultProvider);
  const pinned = run.orchestratorRouting ?? null;
  const [providerId, setProviderId] = useState<ProviderId>(
    pinned?.providerId ?? automatic.providerId,
  );
  const model = pinned?.model ?? '';
  const recommendedModel = resolveTaskModel('workflow_orchestrator', taskModels, providerId).model;
  const effortModel = model === '' ? recommendedModel : model;
  const effortValue = pinned?.effort ?? automatic.effort ?? DEFAULT_EFFORT;
  const connectedProviders = providers
    .filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id)
    .filter((candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0);

  const apply = (next: { readonly model: string; readonly effort?: ModelEffort }) => {
    void setWorkflowOrchestratorRouting(sessionId, run.id, {
      providerId,
      model: next.model,
      ...(next.effort != null && { effort: next.effort }),
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
          value: effortForModel(effortModel, effortValue) ?? effortValue,
          onChange: (effort) => {
            const applied = effortForModel(effortModel, effort);
            apply({
              model: effortModel,
              ...(applied != null && { effort: applied }),
            });
          },
        }}
        recommendation={{ model: recommendedModel }}
        disabled={disabled}
        overridden={pinned != null}
        defaultSummary={`${automatic.providerId} ${automatic.model}`}
        onReset={() => void setWorkflowOrchestratorRouting(sessionId, run.id, null)}
        onProvider={(next) => {
          if (next === '') {
            return;
          }
          setProviderId(next);
          if (pinned == null) {
            return;
          }
          apply(resolveTaskModel('workflow_orchestrator', taskModels, next));
        }}
        onModel={(nextModel) => {
          if (nextModel === '') {
            void setWorkflowOrchestratorRouting(sessionId, run.id, null);
            return;
          }
          const carried = pinned?.effort == null ? null : effortForModel(nextModel, pinned.effort);
          apply({ model: nextModel, ...(carried != null && { effort: carried }) });
        }}
      />
    </div>
  );
};
