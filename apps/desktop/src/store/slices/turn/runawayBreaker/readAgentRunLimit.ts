import { PROVIDER_ID_TO_NAME } from '@goodboy/core/budget';
import type { AgentId, SessionId, WorkflowRun } from '@goodboy/types';
import { invokeBudgetRuleList, invokeSessionBudgetGet } from '../../../../features/budget/budget';
import { autoRoutableProviders } from '../../../../features/providers/autoRoutableProviders';
import { READ_FAILED } from '../../notifications/errorRecovery';
import { sessionById } from '../../sessions/sessionIndex';
import { isWorkflowRunLimited } from './isWorkflowRunLimited';
import type { GetFn } from '../types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export type AgentRunLimit = Readonly<{
  isLimited: boolean;
  run: WorkflowRun | null;
}>;

export const readAgentRunLimit = async ({
  get,
  sessionId,
  agentId,
}: Params): Promise<AgentRunLimit> => {
  const state = get();
  const agent = (state.sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId);
  const runId = agent?.workflowRunId ?? null;
  const run =
    runId === null
      ? null
      : (sessionById(state.sessions, sessionId)?.workflowRuns.find(
          (candidate) => candidate.id === runId,
        ) ?? null);
  const pinned = agent?.providerOverride ?? null;
  const routable = autoRoutableProviders({ providers: state.providers, pinned });
  const providers = [...new Set([...routable, ...(pinned === null ? [] : [pinned])])].map(
    (provider) => PROVIDER_ID_TO_NAME[provider],
  );
  try {
    const [sessionBudget, budgetRules] = await Promise.all([
      invokeSessionBudgetGet(sessionId),
      invokeBudgetRuleList(),
    ]);
    return {
      isLimited: isWorkflowRunLimited({ run, sessionBudget, budgetRules, providers }),
      run,
    };
  } catch (error) {
    void get().reportError({
      recovery: READ_FAILED,
      title: "Couldn't read the spend limits",
      error,
      sessionId,
    });
    return { isLimited: false, run };
  }
};
