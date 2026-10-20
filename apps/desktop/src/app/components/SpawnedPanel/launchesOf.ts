import type { Agent, AgentId, Workflow, WorkflowRun } from '@goodboy/types';

type Attached = Readonly<{
  run: WorkflowRun;
  workflow: Workflow;
}>;

export type Launch =
  | Readonly<{ kind: 'run'; id: string; at: string; run: WorkflowRun; workflow: Workflow }>
  | Readonly<{ kind: 'auto'; id: string; at: string; rootAgentId: AgentId }>;

type Params = {
  readonly attached: ReadonlyArray<Attached>;
  readonly roots: ReadonlyArray<Agent>;
};

export const launchesOf = ({ attached, roots }: Params): ReadonlyArray<Launch> => {
  const runs = attached.flatMap(({ run, workflow }): ReadonlyArray<Launch> =>
    run.discardedAt != null || run.executionMode === 'dynamic'
      ? []
      : [{ kind: 'run', id: `run:${run.id}`, at: run.createdAt ?? '', run, workflow }],
  );
  const autos = roots.map((agent): Launch => ({
    kind: 'auto',
    id: `auto:${agent.id}`,
    at: agent.startedAt ?? '',
    rootAgentId: agent.id,
  }));
  return [...runs, ...autos].sort((a, b) => b.at.localeCompare(a.at));
};
