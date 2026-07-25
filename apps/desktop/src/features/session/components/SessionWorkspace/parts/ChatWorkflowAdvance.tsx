import { useMemo } from 'react';
import type { Agent, SessionId, Step, Workflow, WorkflowRunId } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions } from '../../../../../store';
import { workflowRunHasOpenQuestions } from '../../../../context/openQuestionsGate';
import { resolveWorkflowAdvance } from '../../../../workflows/advanceGate';
import { WorkflowNextStepCta } from '../../../../workflows/components/WorkflowNextStepCta';

type Props = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflow: Workflow;
};

export const ChatWorkflowAdvance = ({ sessionId, workflowRunId, workflow }: Props) => {
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const agentTurnState = useAppStore((state) => state.agentTurnState);
  const isSummarizerRunning = useAppStore(
    (state) => state.summarizerStatus?.[sessionId]?.status === 'running',
  );
  const openQuestions = useSessionOpenQuestions(sessionId);
  const activateWorkflowAgent = useAppStore((state) => state.activateWorkflowAgent);
  const skipStuckStepAndAdvance = useAppStore((state) => state.skipStuckStepAndAdvance);

  const stepAgents = useMemo(
    () =>
      runsForWorkflowRun(phaseRuns, workflowRunId).filter(
        (agent) => agent.parentAgentId == null && agent.stepId != null,
      ),
    [phaseRuns, workflowRunId],
  );
  const isTurnRunning = stepAgents.some((agent) => {
    const turn = agentTurnState?.[agent.id];
    return agent.status === 'running' || turn?.kind === 'running' || turn?.kind === 'starting';
  });

  const state = resolveWorkflowAdvance({
    workflow,
    agents: stepAgents,
    hasOpenQuestions: workflowRunHasOpenQuestions(openQuestions, workflowRunId),
    isSummarizerRunning,
    isTurnRunning,
  });
  if (state.kind === 'complete') {
    return null;
  }

  const onAdvance = async (step: Step) => {
    const pending = stepAgents.find(
      (agent) => agent.stepId === step.id && agent.status === 'pending',
    );
    if (pending == null) {
      return;
    }
    await activateWorkflowAgent(sessionId, pending.id);
  };

  return (
    <div className="flex shrink-0 items-center px-3 pb-2">
      <WorkflowNextStepCta
        workflow={workflow}
        runs={stepAgents}
        blockReason={state.kind === 'blocked' ? state.reason : null}
        onAdvance={(step) => void onAdvance(step)}
        onForceAdvance={() => void skipStuckStepAndAdvance(sessionId, workflowRunId)}
        className="w-full max-w-sm"
      />
    </div>
  );
};
