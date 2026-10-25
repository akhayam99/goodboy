import type { AgentId, Workflow, WorkflowRun } from '@goodboy/types';
import { VISIBLE_FINISHED_COUNT } from '../../../features/session/finishedRunsCap';
import type { SessionRun } from '../../../features/session/sessionRunsOf';

type Attached = Readonly<{
  run: WorkflowRun;
  workflow: Workflow;
}>;

type Base = Readonly<{
  id: string;
  at: number;
  isFinished: boolean;
}>;

export type Launch =
  | (Base & Readonly<{ kind: 'run'; run: WorkflowRun; workflow: Workflow }>)
  | (Base & Readonly<{ kind: 'auto'; rootAgentId: AgentId }>)
  | (Base & Readonly<{ kind: 'agent'; agentId: AgentId }>);

type Params = {
  readonly runs: ReadonlyArray<SessionRun>;
  readonly attached: ReadonlyArray<Attached>;
};

type LaunchParams = {
  readonly entry: SessionRun;
  readonly attached: ReadonlyArray<Attached>;
};

const launchOf = ({ entry, attached }: LaunchParams): Launch | null => {
  const base = { at: entry.startedAt, isFinished: entry.isFinished };
  switch (entry.open.kind) {
    case 'run': {
      const { runId } = entry.open;
      const found = attached.find(({ run }) => run.id === runId);
      return found === undefined
        ? null
        : { ...base, kind: 'run', id: `run:${runId}`, run: found.run, workflow: found.workflow };
    }
    case 'auto':
      return {
        ...base,
        kind: 'auto',
        id: `auto:${entry.open.agentId}`,
        rootAgentId: entry.open.agentId,
      };
    case 'agent':
      return {
        ...base,
        kind: 'agent',
        id: `agent:${entry.open.agentId}`,
        agentId: entry.open.agentId,
      };
    default: {
      const unreachable: never = entry.open;
      return unreachable;
    }
  }
};

export const launchesOf = ({ runs, attached }: Params): ReadonlyArray<Launch> => {
  const launches = runs
    .filter((entry) => !entry.isArchived)
    .flatMap((entry) => {
      const launch = launchOf({ entry, attached });
      return launch === null ? [] : [launch];
    })
    .sort((a, b) => b.at - a.at);
  let finishedSeen = 0;
  return launches.filter((launch) => {
    if (!launch.isFinished) {
      return true;
    }
    finishedSeen += 1;
    return finishedSeen <= VISIBLE_FINISHED_COUNT;
  });
};
