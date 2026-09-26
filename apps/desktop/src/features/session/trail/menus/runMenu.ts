import type { Agent, Workflow, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import type {
  CrumbMenuAction,
  CrumbMenuGroup,
  CrumbMenuModel,
  CrumbMenuRow,
  CrumbState,
} from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

export type RunEntry = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly isFinished: boolean;
};

type Params = {
  readonly runs: ReadonlyArray<RunEntry>;
  readonly agents: ReadonlyArray<Agent>;
  readonly currentRunId: WorkflowRunId | null;
  readonly nameOf: (entry: RunEntry) => string;
  readonly actions: ReadonlyArray<CrumbMenuAction>;
  readonly onSelect: (runId: WorkflowRunId) => void;
};

const stepAgentsOf = ({
  agents,
  runId,
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly runId: WorkflowRunId;
}): ReadonlyArray<Agent> =>
  agents.filter(
    (agent) => agent.workflowRunId === runId && agent.stepId != null && agent.parentAgentId == null,
  );

const runState = ({
  entry,
  stepAgents,
}: {
  readonly entry: RunEntry;
  readonly stepAgents: ReadonlyArray<Agent>;
}): CrumbState => {
  if (entry.run.discardedAt != null) {
    return { word: 'Stopped', tone: 'neutral' };
  }
  if (entry.isFinished) {
    return { word: 'Done', tone: 'success' };
  }
  if (stepAgents.some((agent) => agent.status === 'blocked' || agent.status === 'failed')) {
    return { word: 'Needs you', tone: 'warning' };
  }
  if (stepAgents.some((agent) => agent.status === 'running')) {
    return { word: 'Running', tone: 'info' };
  }
  return { word: 'Waiting', tone: 'neutral' };
};

export const runMenu = ({
  runs,
  agents,
  currentRunId,
  nameOf,
  actions,
  onSelect,
}: Params): CrumbMenuModel => {
  const nameById = new Map(runs.map((entry) => [entry.run.id, nameOf(entry)]));
  const rowOf = (entry: RunEntry): CrumbMenuRow => {
    const stepAgents = stepAgentsOf({ agents, runId: entry.run.id });
    const total = entry.workflow.steps.filter((step) => step.deletedAt == null).length;
    const done = stepAgents.filter((agent) => agent.status === 'completed').length;
    const after = entry.run.chainAfterId ?? null;
    const predecessor = after === null ? null : (nameById.get(after) ?? null);
    return {
      id: entry.run.id,
      lead: { kind: 'icon', icon: CONCEPT_ICONS.workflows },
      label: nameOf(entry),
      secondary:
        predecessor !== null
          ? `after ${predecessor}`
          : entry.run.title != null
            ? entry.workflow.name
            : null,
      metaA: `${done} of ${total}`,
      state: runState({ entry, stepAgents }),
      isCurrent: entry.run.id === currentRunId,
      isDisabled: false,
      indent: predecessor !== null ? 1 : 0,
      onSelect: () => onSelect(entry.run.id),
    };
  };
  const ordered = (entries: ReadonlyArray<RunEntry>): ReadonlyArray<RunEntry> => {
    const ids = new Set(entries.map((entry) => entry.run.id));
    const roots = entries.filter(
      (entry) => entry.run.chainAfterId == null || !ids.has(entry.run.chainAfterId),
    );
    const childrenOf = (id: WorkflowRunId): ReadonlyArray<RunEntry> =>
      entries.filter((entry) => entry.run.chainAfterId === id);
    return roots.flatMap((root) => [root, ...childrenOf(root.run.id)]);
  };
  const running = ordered(runs.filter((entry) => !entry.isFinished));
  const finished = ordered(runs.filter((entry) => entry.isFinished));
  const groups: ReadonlyArray<CrumbMenuGroup> = [
    { id: 'running', label: 'Running', rows: running.map(rowOf) },
    { id: 'finished', label: 'Finished', rows: finished.map(rowOf) },
  ].filter((group) => group.rows.length > 0);

  return {
    title: 'Workflow runs',
    context: 'this session',
    count: runs.length,
    triggerLabel: 'Switch run',
    groups,
    actions: actions.slice(0, 2),
    width: 'regular',
    filterPlaceholder: 'Filter runs',
  };
};
