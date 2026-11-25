import type { Session, WorkflowRun } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import type { RunRow, RunsFields } from '../contract/projections';
import { actionIdOf } from './actionIdOf';
import { agentRowOf } from './agentRowOf';
import { runMarkOf } from './runMarkOf';
import { runStateOf } from './runStateOf';
import type { WorkspaceScope } from './workspaceScope';

export const RUN_LIMIT = 20;

type Params = {
  readonly scope: WorkspaceScope;
  readonly session: Session;
  readonly now: number;
};

type RunParams = {
  readonly scope: WorkspaceScope;
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly now: number;
};

const WORDS = {
  running: 'Running',
  paused: 'Paused at the limit',
  waiting: 'Needs you',
  stopped: 'Stopped',
  done: 'Done',
  failed: 'Failed',
} as const;

const runRowOf = ({ scope, session, run, now }: RunParams): RunRow => {
  const sessionAgents = scope.agents[session.id] ?? [];
  const agents = sessionAgents.filter(
    (agent) => agent.workflowRunId === run.id && agent.deletedAt == null,
  );
  const state = runStateOf({ run, agents: sessionAgents });
  const canStop = state === 'running';
  const canContinue = state === 'waiting' || state === 'paused' || state === 'stopped';
  const records = scope.telemetry[session.id] ?? [];
  const runIds = new Set(
    agents.flatMap((agent) => (agent.runId === undefined ? [] : [agent.runId])),
  );
  const spend = records
    .filter((record) => runIds.has(record.runId))
    .reduce((sum, record) => sum + record.estimatedCostUsd, 0);
  return {
    runId: run.id,
    title: run.title ?? run.goal ?? 'Run',
    mark: runMarkOf({ state }),
    state,
    words: WORDS[state],
    spendText: runIds.size === 0 || spend === 0 ? null : formatUsd(spend),
    stopActionId: canStop
      ? actionIdOf({ kind: 'stopRun', objectId: run.id, version: state })
      : null,
    continueActionId: canContinue
      ? actionIdOf({ kind: 'continueRun', objectId: run.id, version: state })
      : null,
    limit:
      run.spendLimitUsd === undefined
        ? null
        : { amount: run.spendLimitUsd, text: formatUsd(run.spendLimitUsd) },
    canStop,
    canContinue,
    agents: agents.map((agent) => agentRowOf({ scope, sessionId: session.id, agent, now })),
  };
};

export const runsFieldsOf = ({ scope, session, now }: Params): RunsFields => ({
  workspaceId: scope.workspace.id,
  sessionId: session.id,
  runs: session.workflowRuns
    .filter((run) => run.discardedAt == null)
    .slice(-RUN_LIMIT)
    .map((run) => runRowOf({ scope, session, run, now })),
});
