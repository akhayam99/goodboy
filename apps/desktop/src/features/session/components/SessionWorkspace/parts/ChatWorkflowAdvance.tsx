import { useMemo } from 'react';
import type { Agent, SessionId, Step, Workflow, WorkflowRun } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions } from '../../../../../store';
import { notifyWorkflowGateBlock } from '../../../../../store/slices/workflows/notifyWorkflowGateBlock';
import { workflowRunHasOpenQuestions } from '../../../../context/openQuestionsGate';
import { agentRoutingOverrides } from '../../../../workflows/agentRoutingOverrides';
import { resolveWorkflowAdvance } from '../../../../workflows/advanceGate';
import { WorkflowNextStepCta } from '../../../../workflows/components/WorkflowNextStepCta';
import { useSessionRoleModels } from '../../../../../shared/hooks/useSessionRoleModels';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

type AdvanceParams = {
  readonly step: Step;
  readonly isConfirmed: boolean;
};

export const ChatWorkflowAdvance = ({ sessionId, run, workflow }: Props) => {
  const workflowRunId = run.id;
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const isSummarizerRunning = useAppStore(
    (state) => state.summarizerStatus?.[sessionId]?.status === 'running',
  );
  const openQuestions = useSessionOpenQuestions(sessionId);
  const hasOpenQuestions = workflowRunHasOpenQuestions(openQuestions, workflowRunId);
  const isAutoRun = run.autoRun === true;
  const roleModels = useSessionRoleModels({ sessionId });
  const activateWorkflowAgent = useAppStore((state) => state.activateWorkflowAgent);
  const skipStuckStepAndAdvance = useAppStore((state) => state.skipStuckStepAndAdvance);
  const emitNotification = useAppStore((state) => state.emitNotification);

  const stepAgents = useMemo(
    () =>
      runsForWorkflowRun(phaseRuns, workflowRunId).filter(
        (agent) => agent.parentAgentId == null && agent.stepId != null,
      ),
    [phaseRuns, workflowRunId],
  );
  const hasRunningTurn = useAppStore((state) =>
    stepAgents.some((agent) => {
      const turn = state.agentTurnState[agent.id];
      return turn?.kind === 'running' || turn?.kind === 'starting';
    }),
  );
  const isTurnRunning = hasRunningTurn || stepAgents.some((agent) => agent.status === 'running');

  const state = resolveWorkflowAdvance({
    workflow,
    agents: stepAgents,
    hasOpenQuestions,
    isSummarizerRunning,
    isTurnRunning,
    isAutoRun,
  });
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

  if (state.kind === 'complete' || state.kind === 'automatic') {
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
      notifyWorkflowGateBlock({ error, sessionId, emitNotification });
    }
  };

  return (
    <WorkflowNextStepCta
      workflow={workflow}
      runs={stepAgents}
      roleModels={roleModels}
      agentModel={routing.agentModel}
      agentProvider={routing.agentProvider}
      agentEffort={routing.agentEffort}
      blockReason={state.kind === 'blocked' ? state.reason : null}
      onAdvance={({ step, isConfirmed }) => void onAdvance({ step, isConfirmed })}
      onForceAdvance={() =>
        void skipStuckStepAndAdvance(sessionId, workflowRunId, { onlyWhenBlocked: true })
      }
      className="ml-auto shrink-0"
    />
  );
};
