import type { Agent, Session, SessionId, TurnState, WorkflowRun } from '@goodboy/types';
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

type RunStateFromParams = {
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
};

export const runStateFrom = ({ run, agents }: RunStateFromParams): RunState => {
  if (run.orchestrationStop?.kind === 'closed') {
    return 'stopped';
  }
  if (run.orchestrationOutcome === 'done') {
    return 'done';
  }
  if (run.orchestrationStop?.kind === 'failure') {
    return 'failed';
  }
  if (
    run.orchestrationStop?.kind === 'operator' ||
    run.orchestrationStop?.kind === 'paused' ||
    run.orchestrationStop?.kind === 'budget'
  ) {
    return 'paused';
  }
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

type RunStateParams = {
  readonly store: AppStore;
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
};

export const runStateOf = ({ store, sessionId, run }: RunStateParams): RunState =>
  runStateFrom({
    run,
    agents: (store.sessionPhaseRuns[sessionId] ?? []).filter(
      (agent) => agent.workflowRunId === run.id,
    ),
  });

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

type AgentStateFromParams = {
  readonly turn: TurnState | undefined;
  readonly agent: Agent | undefined;
};

export const agentStateFrom = ({ turn, agent }: AgentStateFromParams): AgentState => {
  if (turn?.kind === 'running') {
    return 'running';
  }
  if (turn?.kind === 'blocked') {
    return 'waiting';
  }
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

export const agentStateOf = ({ store, sessionId, agentId }: AgentParams): AgentState =>
  agentStateFrom({
    turn: store.agentTurnState[agentIdOf({ value: agentId })],
    agent: (store.sessionPhaseRuns[sessionId] ?? []).find((candidate) => candidate.id === agentId),
  });
