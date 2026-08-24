import type { Agent, SessionId, StepId, Workflow } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { agentRoutingOverrides } from '../../../workflows/agentRoutingOverrides';
import { useAdvanceWorkflowAgent } from '../../../workflows/useAdvanceWorkflowAgent';
import { WorkflowNextStepCta } from '../../../workflows/components/WorkflowNextStepCta';

type Props = {
  readonly sessionId: SessionId;
  readonly workflow: Workflow;
  readonly runAgents: ReadonlyArray<Agent>;
  readonly stepId: StepId;
};

const pendingForStep = ({
  runAgents,
  stepId,
}: {
  readonly runAgents: ReadonlyArray<Agent>;
  readonly stepId: StepId;
}): Agent | null =>
  runAgents.find((agent) => agent.stepId === stepId && agent.status === 'pending') ?? null;

export const OverviewNextStep = ({ sessionId, workflow, runAgents, stepId }: Props) => {
  const roleModels = useSessionRoleModels({ sessionId });
  const sessionProvider = useAppStore(
    (state) =>
      state.sessions?.find((candidate) => candidate.id === sessionId)?.providerPreference
        .defaultProvider ?? null,
  );
  const sessionEffort = useAppStore(
    (state) => state.sessions?.find((candidate) => candidate.id === sessionId)?.effort ?? null,
  );
  const advanceAgent = useAdvanceWorkflowAgent({ sessionId });
  const nextAgent = pendingForStep({ runAgents, stepId });
  const modelOverride = useAppStore((state) =>
    nextAgent != null ? (state.agentModelOverride[nextAgent.id] ?? null) : null,
  );
  const providerOverride = useAppStore((state) =>
    nextAgent != null ? (state.agentProviderOverride[nextAgent.id] ?? null) : null,
  );
  const effortOverride = useAppStore((state) =>
    nextAgent != null ? (state.agentEffortOverride[nextAgent.id] ?? null) : null,
  );
  const routing = agentRoutingOverrides({
    agent: nextAgent,
    modelOverride,
    providerOverride,
    effortOverride,
  });

  return (
    <WorkflowNextStepCta
      workflow={workflow}
      runs={runAgents}
      roleModels={roleModels}
      agentModel={routing.agentModel}
      agentProvider={routing.agentProvider}
      agentEffort={routing.agentEffort}
      sessionProvider={sessionProvider}
      sessionEffort={sessionEffort}
      onAdvance={({ step, isConfirmed }) => {
        void advanceAgent({ agent: pendingForStep({ runAgents, stepId: step.id }), isConfirmed });
      }}
    />
  );
};
