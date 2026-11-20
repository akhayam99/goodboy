import type { AgentId, SessionId } from '@goodboy/types';
import { sessionById } from '../../sessions/sessionIndex';
import { isWorkflowRunLimited } from './isWorkflowRunLimited';
import type { GetFn } from '../types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const isAgentRunLimited = ({ get, sessionId, agentId }: Params): boolean => {
  const state = get();
  const agent = (state.sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId);
  const runId = agent?.workflowRunId ?? null;
  const run =
    runId === null
      ? null
      : (sessionById(state.sessions, sessionId)?.workflowRuns.find(
          (candidate) => candidate.id === runId,
        ) ?? null);
  return isWorkflowRunLimited({
    run,
    sessionBudget: state.sessionBudgets[sessionId] ?? null,
    budgetRules: state.budgetRules,
  });
};
