import type { Session, SessionId, WorkflowRun } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import type { AgentState, RunState } from '../contract/projections';
import { agentIdOf } from './ids';

type SessionParams = {
  readonly store: AppStore;
  readonly workspaceId: string;
  readonly sessionId: string;
};

export const sessionOfAction = ({
  store,
  workspaceId,
  sessionId,
}: SessionParams): Session | null => {
  const session = sessionById(store.sessions, sessionId);
  if (session === undefined || session.workspaceId !== workspaceId) {
    return null;
  }
  return session;
};

type RunParams = {
  readonly session: Session;
  readonly runId: string;
};

export const workflowRunOf = ({ session, runId }: RunParams): WorkflowRun | null =>
  session.workflowRuns.find((run) => run.id === runId && run.discardedAt == null) ?? null;

type RunStateParams = {
  readonly store: AppStore;
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
};

export const runStateOf = ({ store, sessionId, run }: RunStateParams): RunState => {
  if (run.orchestrationStop?.kind === 'closed') {
    return 'stopped';
  }
  if (run.orchestrationOutcome === 'done') {
    return 'done';
  }
  if (run.orchestrationStop?.kind === 'failure') {
    return 'failed';
  }
  if (run.orchestrationStop?.kind === 'operator' || run.orchestrationStop?.kind === 'paused') {
    return 'paused';
  }
  const agents = (store.sessionPhaseRuns[sessionId] ?? []).filter(
    (agent) => agent.workflowRunId === run.id,
  );
  if (agents.some((agent) => agent.status === 'running')) {
    return 'running';
  }
  if (
    run.orchestrationOutcome === 'blocked' ||
    agents.some((agent) => agent.status === 'blocked')
  ) {
    return 'waiting';
  }
  return 'running';
};

type AgentParams = {
  readonly store: AppStore;
  readonly sessionId: SessionId;
  readonly agentId: string;
};

export const isAgentOfSession = ({ store, sessionId, agentId }: AgentParams): boolean => {
  if ((store.sessionPhaseRuns[sessionId] ?? []).some((agent) => agent.id === agentId)) {
    return true;
  }
  return (store.autoTreeViews?.[sessionId] ?? []).some(
    (view) =>
      view.tree.rootAgentId === agentId ||
      view.delegations.some((delegation) => delegation.childAgentId === agentId),
  );
};

export const agentStateOf = ({ store, sessionId, agentId }: AgentParams): AgentState => {
  const turn = store.agentTurnState[agentIdOf({ value: agentId })];
  if (turn?.kind === 'running') {
    return 'running';
  }
  if (turn?.kind === 'blocked') {
    return 'waiting';
  }
  const agent = (store.sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.id === agentId,
  );
  if (agent?.status === 'stopped' || agent?.stoppedAt !== undefined) {
    return 'stopped';
  }
  if (agent?.status === 'failed' || turn?.kind === 'error') {
    return 'failed';
  }
  if (agent?.status === 'running') {
    return 'running';
  }
  return 'done';
};
