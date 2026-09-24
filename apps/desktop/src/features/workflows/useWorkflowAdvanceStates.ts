import { useMemo } from 'react';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../store';
import { workflowRunHasOpenQuestions } from '../context/openQuestionsGate';
import type { AttachedRun } from './activeWorkflowRuns';
import { resolveWorkflowAdvance, type WorkflowAdvanceState } from './advanceGate';

const RUN_ID_SEPARATOR = '\n';

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
  const turningRunIds = useAppStore((state) => {
    const runIds = new Set<string>();
    for (const agent of agents) {
      if (agent.workflowRunId == null) {
        continue;
      }
      const turn = state.agentTurnState?.[agent.id];
      if (turn?.kind === 'running' || turn?.kind === 'starting') {
        runIds.add(agent.workflowRunId);
      }
    }
    return [...runIds].sort().join(RUN_ID_SEPARATOR);
  });

  return useMemo(() => {
    const turning = new Set(turningRunIds.split(RUN_ID_SEPARATOR));
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
          hasOpenQuestions: workflowRunHasOpenQuestions({ questions, run: attached.run }),
          isSummarizerRunning,
          isTurnRunning: turning.has(attached.run.id),
          isAutoRun: attached.run.autoRun === true,
        }),
      );
    }
    return states;
  }, [agents, isSummarizerRunning, questions, turningRunIds, workflows]);
};
