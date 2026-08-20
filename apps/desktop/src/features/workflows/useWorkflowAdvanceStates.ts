import { useMemo } from 'react';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../store';
import { workflowRunHasOpenQuestions } from '../context/openQuestionsGate';
import type { AttachedRun } from './activeWorkflowRuns';
import { resolveWorkflowAdvance, type WorkflowAdvanceState } from './advanceGate';

type Params = {
  readonly sessionId: SessionId;
  readonly workflows: ReadonlyArray<AttachedRun>;
  readonly agents: ReadonlyArray<Agent>;
};

export const useWorkflowAdvanceStates = ({
  sessionId,
  workflows,
  agents,
}: Params): ReadonlyMap<string, WorkflowAdvanceState> => {
  const questions = useSessionOpenQuestions(sessionId);
  const isSummarizerRunning = useAppStore(
    (state) => state.summarizerStatus?.[sessionId]?.status === 'running',
  );
  const hasRunningTurn = useAppStore((state) =>
    agents.some((agent) => {
      const turn = state.agentTurnState?.[agent.id];
      return turn?.kind === 'running' || turn?.kind === 'starting';
    }),
  );

  return useMemo(() => {
    const states = new Map<string, WorkflowAdvanceState>();
    for (const attached of workflows) {
      const runAgents = agents.filter(
        (agent) =>
          agent.workflowRunId === attached.run.id &&
          agent.parentAgentId == null &&
          agent.stepId != null,
      );
      states.set(
        attached.run.id,
        resolveWorkflowAdvance({
          workflow: attached.workflow,
          agents: runAgents,
          hasOpenQuestions: workflowRunHasOpenQuestions(questions, attached.run.id),
          isSummarizerRunning,
          isTurnRunning: hasRunningTurn,
          isAutoRun: attached.run.autoRun === true,
        }),
      );
    }
    return states;
  }, [agents, hasRunningTurn, isSummarizerRunning, questions, workflows]);
};
