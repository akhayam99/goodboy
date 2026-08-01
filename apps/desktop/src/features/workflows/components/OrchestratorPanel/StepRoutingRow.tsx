import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { ProviderId, SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { WorkflowStepRoutingPicker } from '../WorkflowStepRoutingPicker';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly disabled: boolean;
};

export const StepRoutingRow = ({ sessionId, run, disabled }: Props) => {
  const session = useAppStore((state) =>
    state.sessions.find((current) => current.id === sessionId),
  );
  const providers = useAppStore((state) => state.providers);
  const setWorkflowStepRouting = useAppStore((state) => state.setWorkflowStepRouting);
  const defaultProvider = (session?.providerOverride ??
    session?.providerPreference.defaultProvider ??
    'anthropic') as ProviderId;
  const connectedProviders = providers
    .filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id)
    .filter((candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0);

  return (
    <div
      data-testid="step-routing"
      className="flex min-w-0 flex-wrap items-center gap-1.5 text-2xs text-muted-foreground"
    >
      <span>steps run on</span>
      <WorkflowStepRoutingPicker
        connectedProviders={connectedProviders}
        defaultProvider={defaultProvider}
        routing={run.stepRouting ?? null}
        disabled={disabled}
        variant="pill"
        onChange={(routing) => void setWorkflowStepRouting(sessionId, run.id, routing)}
      />
    </div>
  );
};
