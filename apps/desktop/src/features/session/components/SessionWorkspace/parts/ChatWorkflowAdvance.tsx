import { useMemo } from 'react';
import type { Agent, SessionId, Step, Workflow, WorkflowRunId } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions } from '../../../../../store';
import { workflowRunHasOpenQuestions } from '../../../../context/openQuestionsGate';
import { resolveWorkflowAdvance } from '../../../../workflows/advanceGate';
import { WorkflowNextStepCta } from '../../../../workflows/components/WorkflowNextStepCta';
import { useSessionRoleModels } from '../../../../../shared/hooks/useSessionRoleModels';

type Props = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflow: Workflow;
};

type AdvanceParams = {
  readonly step: Step;
  readonly isConfirmed: boolean;
};

export const ChatWorkflowAdvance = ({ sessionId, workflowRunId, workflow }: Props) => {
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const isSummarizerRunning = useAppStore(
    (state) => state.summarizerStatus?.[sessionId]?.status === 'running',
  );
  const openQuestions = useSessionOpenQuestions(sessionId);
  const isAutoRun = useAppStore(
    (state) =>
      state.sessions
        .find((session) => session.id === sessionId)
        ?.workflowRuns.find((run) => run.id === workflowRunId)?.autoRun === true,
  );
  const roleModels = useSessionRoleModels({ sessionId });
  const activateWorkflowAgent = useAppStore((state) => state.activateWorkflowAgent);
  const skipStuckStepAndAdvance = useAppStore((state) => state.skipStuckStepAndAdvance);

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
    hasOpenQuestions: workflowRunHasOpenQuestions(openQuestions, workflowRunId),
    isSummarizerRunning,
    isTurnRunning,
    isAutoRun,
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
    await activateWorkflowAgent({
      sessionId,
      agentId: pending.id,
      focus: 'agent',
      bypassGate: isConfirmed,
    });
  };

  return (
    <WorkflowNextStepCta
      workflow={workflow}
      runs={stepAgents}
      roleModels={roleModels}
      blockReason={state.kind === 'blocked' ? state.reason : null}
      onAdvance={({ step, isConfirmed }) => void onAdvance({ step, isConfirmed })}
      onForceAdvance={() =>
        void skipStuckStepAndAdvance(sessionId, workflowRunId, { onlyWhenBlocked: true })
      }
      className="ml-auto shrink-0"
    />
  );
};
