import type { SessionId, Step, Workflow, WorkflowRun } from '@goodboy/types';
import { PageColumn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { isRunHeldForPlan } from '../../../../store/slices/workflows/workflowPlanApproval';
import { notifyWorkflowGateBlock } from '../../../../store/slices/workflows/notifyWorkflowGateBlock';
import { WorkflowGateError } from '../../../../store/slices/workflows/workflowActivationGate';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { agentRoutingOverrides } from '../../agentRoutingOverrides';
import { useWorkflowRunAdvance } from '../../hooks/useWorkflowRunAdvance';
import { WorkflowNextStepCta } from '../WorkflowNextStepCta';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

type AdvanceParams = {
  readonly step: Step;
  readonly isConfirmed: boolean;
};

export const WorkflowAdvance = ({ sessionId, run, workflow }: Props) => {
  const { state, stepAgents } = useWorkflowRunAdvance({ sessionId, run, workflow });
  const roleModels = useSessionRoleModels({ sessionId });
  const sessionProvider = useAppStore(
    (state) => sessionById(state.sessions, sessionId)?.providerPreference.defaultProvider ?? null,
  );
  const sessionEffort = useAppStore(
    (state) => sessionById(state.sessions, sessionId)?.effort ?? null,
  );
  const activateWorkflowAgent = useAppStore((state) => state.activateWorkflowAgent);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const reportError = useAppStore((state) => state.reportError);

  const nextStepId = state.kind === 'complete' ? null : state.step.id;
  const pendingAgent =
    stepAgents.find((agent) => agent.stepId === nextStepId && agent.status === 'pending') ?? null;
  const modelOverride = useAppStore((store) =>
    pendingAgent != null ? (store.agentModelOverride[pendingAgent.id] ?? null) : null,
  );
  const providerOverride = useAppStore((store) =>
    pendingAgent != null ? (store.agentProviderOverride[pendingAgent.id] ?? null) : null,
  );
  const effortOverride = useAppStore((store) =>
    pendingAgent != null ? (store.agentEffortOverride[pendingAgent.id] ?? null) : null,
  );
  const routing = agentRoutingOverrides({
    agent: pendingAgent,
    modelOverride,
    providerOverride,
    effortOverride,
  });

  if (state.kind === 'complete' || state.kind === 'automatic' || isRunHeldForPlan({ run })) {
    return null;
  }

  const onAdvance = async ({ step, isConfirmed }: AdvanceParams) => {
    const pending = stepAgents.find(
      (agent) => agent.stepId === step.id && agent.status === 'pending',
    );
    if (pending == null) {
      return;
    }
    try {
      await activateWorkflowAgent({
        sessionId,
        agentId: pending.id,
        focus: 'agent',
        bypassGate: isConfirmed,
      });
    } catch (error) {
      if (error instanceof WorkflowGateError) {
        notifyWorkflowGateBlock({ error, sessionId, emitNotification });
        return;
      }
      if (!isReportedError(error)) {
        void reportError({ title: "The next step didn't start", error, sessionId });
      }
    }
  };

  return (
    <PageColumn className="shrink-0 pb-1 empty:hidden">
      <WorkflowNextStepCta
        workflow={workflow}
        runs={stepAgents}
        roleModels={roleModels}
        agentModel={routing.agentModel}
        agentProvider={routing.agentProvider}
        agentEffort={routing.agentEffort}
        sessionProvider={sessionProvider}
        sessionEffort={sessionEffort}
        blockReason={state.kind === 'blocked' ? state.reason : null}
        onAdvance={({ step, isConfirmed }) => void onAdvance({ step, isConfirmed })}
      />
    </PageColumn>
  );
};
