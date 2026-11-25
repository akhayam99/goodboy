import type { Session, WorkflowRun } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import type { AgentRow, RunRow, RunsFields } from '../contract/projections';
import { agentMarkOf } from './agentMarkOf';
import { agentStateOf } from './agentStateOf';
import { runMarkOf } from './runMarkOf';
import { runStateOf } from './runStateOf';
import type { WorkspaceScope } from './workspaceScope';

export const RUN_LIMIT = 20;

type Params = {
  readonly scope: WorkspaceScope;
  readonly session: Session;
};

type RunParams = {
  readonly scope: WorkspaceScope;
  readonly session: Session;
  readonly run: WorkflowRun;
};

const WORDS = {
  running: 'Running',
  paused: 'Paused at the limit',
  waiting: 'Waiting for you',
  stopped: 'Stopped',
  done: 'Done',
  failed: 'Failed',
} as const;

const AGENT_WORDS = {
  running: 'Running',
  waiting: 'Waiting for you',
  stopped: 'Stopped',
  done: 'Done',
  failed: 'Failed',
} as const;

const rowOf = ({ scope, session, run }: RunParams): RunRow => {
  const agents = (scope.agents[session.id] ?? []).filter(
    (agent) => agent.workflowRunId === run.id && agent.deletedAt == null,
  );
  const state = runStateOf({ run, agents });
  const isOpen = state === 'running' || state === 'waiting' || state === 'paused';
  const agentRows: ReadonlyArray<AgentRow> = agents.map((agent) => {
    const agentState = agentStateOf({ status: agent.status });
    return {
      agentId: agent.id,
      name: agent.name,
      mark: agentMarkOf({ state: agentState }),
      state: agentState,
      words: AGENT_WORDS[agentState],
      canStop: agentState === 'running',
      canContinue: agentState === 'stopped',
    };
  });
  return {
    runId: run.id,
    title: run.title ?? run.goal ?? 'Run',
    mark: runMarkOf({ state }),
    state,
    words: WORDS[state],
    spendText: null,
    limit:
      run.spendLimitUsd === undefined
        ? null
        : { amount: run.spendLimitUsd, text: formatUsd(run.spendLimitUsd) },
    canStop: state === 'running',
    canContinue: isOpen && state !== 'running',
    agents: agentRows,
  };
};

export const runsFieldsOf = ({ scope, session }: Params): RunsFields => ({
  workspaceId: scope.workspace.id,
  sessionId: session.id,
  runs: session.workflowRuns
    .filter((run) => run.discardedAt == null)
    .slice(-RUN_LIMIT)
    .map((run) => rowOf({ scope, session, run })),
});
