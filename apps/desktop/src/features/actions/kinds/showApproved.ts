import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { planApprovedToast } from '../../plans/planApprovedToast';
import type { AppStore } from '../../../store/store';
import type { ActionEnv } from '../types';

type StepNameParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const stepNameOf = ({ state, sessionId, agentId }: StepNameParams): string =>
  (state.sessionPhaseRuns[sessionId] ?? []).find((agent) => agent.id === agentId)?.name ??
  'The next step';

type RunPageParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
};

const isOnRunPage = ({ state, sessionId, runId }: RunPageParams): boolean =>
  state.currentSessionId === sessionId &&
  state.activeLens[sessionId] === 'workflows' &&
  state.focusedWorkflowRunId[sessionId] === runId;

type ApprovedParams = {
  readonly facts: { readonly sessionId: SessionId };
  readonly env: ActionEnv;
  readonly runId: WorkflowRunId;
  readonly startedAgentId: AgentId | null;
};

export const showApproved = ({ facts, env, runId, startedAgentId }: ApprovedParams): void => {
  const state = env.getState();
  env.showToast(
    planApprovedToast({
      sessionId: facts.sessionId,
      runId,
      startedStepName:
        startedAgentId === null
          ? null
          : stepNameOf({ state, sessionId: facts.sessionId, agentId: startedAgentId }),
      isOnRunPage: isOnRunPage({ state, sessionId: facts.sessionId, runId }),
      navigate: state.navigate,
    }),
  );
};
