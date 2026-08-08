import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import type { Agent, SessionId, Step, Workflow, WorkflowRun } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions } from '../../../../../store';
import { notifyWorkflowGateBlock } from '../../../../../store/slices/workflows/notifyWorkflowGateBlock';
import { workflowRunHasOpenQuestions } from '../../../../context/openQuestionsGate';
import { agentRoutingOverrides } from '../../../../workflows/agentRoutingOverrides';
import { resolveWorkflowAdvance } from '../../../../workflows/advanceGate';
import { WorkflowNextStepCta } from '../../../../workflows/components/WorkflowNextStepCta';
import { WorkflowAutorunToggle } from '../../../../workflows/components/WorkflowAutorunToggle';
import { OrchestratorAction } from '../../../../workflows/components/OrchestratorPanel/OrchestratorAction';
import { resolveOrchestratorState } from '../../../../workflows/components/OrchestratorPanel/orchestratorState';
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
  const isOrchestrating = useAppStore(
    (state) => state.orchestratingWorkflowRuns?.[workflowRunId] ?? false,
  );
  const roleModels = useSessionRoleModels({ sessionId });
  const activateWorkflowAgent = useAppStore((state) => state.activateWorkflowAgent);
  const skipStuckStepAndAdvance = useAppStore((state) => state.skipStuckStepAndAdvance);
  const setWorkflowRunAutoRun = useAppStore((state) => state.setWorkflowRunAutoRun);
  const stopWorkflowRunNow = useAppStore((state) => state.stopWorkflowRunNow);
  const retryWorkflowOrchestration = useAppStore((state) => state.retryWorkflowOrchestration);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const [isResuming, setIsResuming] = useState(false);

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

  const isOperatorStopped = isAutoRun === false && run.orchestrationStop?.kind === 'operator';
  const showAutorunToggle = state.kind === 'automatic' || isOperatorStopped;
  const orchestratorPhase =
    run.executionMode === 'dynamic'
      ? resolveOrchestratorState({
          run,
          agents: stepAgents,
          isOrchestrating,
          hasOpenQuestions,
          costUsd: 0,
        }).phase
      : null;
  const showResume = showAutorunToggle && orchestratorPhase === 'stopped';

  if (state.kind === 'complete') {
    return null;
  }

  const onResume = async () => {
    if (isResuming) {
      return;
    }
    setIsResuming(true);
    try {
      await retryWorkflowOrchestration(sessionId, workflowRunId);
    } finally {
      setIsResuming(false);
    }
  };

  if (showAutorunToggle) {
    return (
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {showResume ? (
          <OrchestratorAction
            icon={Play}
            label="Resume the run"
            variant="primary"
            tone="warning"
            testId="chat-workflow-orchestrator-resume"
            title="Clear the stop, put autorun back on, and ask for the next step"
            disabled={isResuming}
            onClick={() => void onResume()}
          />
        ) : null}
        <WorkflowAutorunToggle
          variant="detail"
          isOn={isAutoRun}
          isStepInFlight={isOrchestrating || stepAgents.some((agent) => agent.status === 'running')}
          onToggle={() => void setWorkflowRunAutoRun(sessionId, workflowRunId, !isAutoRun)}
          onStopNow={() => void stopWorkflowRunNow(sessionId, workflowRunId)}
        />
      </div>
    );
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
