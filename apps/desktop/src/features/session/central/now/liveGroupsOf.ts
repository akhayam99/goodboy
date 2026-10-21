import type { AutoPhase } from '@goodboy/db';
import type { Agent, AgentId, MountId, Step } from '@goodboy/types';
import { autoGroupOf, type AutoGroup } from '../../../auto/autoGroupOf';
import type { AgentKind } from '../../agent-kind';
import {
  resolveAgentRowState,
  type RowPhase,
  type RowState,
} from '../../../workTreeModel/rowState';
import { runWorkflowKind } from '../../timeline/runWorkflowKind';
import {
  runStepCounts,
  runStepStates,
  type RunStepCounts,
  type RunStepState,
} from '../../timeline/runStepProgress';
import { buildTimelineStream } from '../../timeline/buildTimelineStream';
import type {
  TimelineAgentEntry,
  TimelineRunEntry,
  TimelineTopLevelEntry,
} from '../../timeline/buildTimelineGroups';
import type { SessionWorkModel } from '../useSessionWorkModel';

export type LiveGroupState = 'stuck' | 'waiting' | 'working' | 'deciding';

export type LiveChild = Readonly<{
  agentId: AgentId;
  agentKind: AgentKind;
  title: string;
  phase: RowPhase;
}>;

type LiveGroupBase = Readonly<{
  id: string;
  title: string;
  state: LiveGroupState;
  mountId: MountId | null;
  startedAt: number;
}>;

type LiveRunStep = Readonly<{
  number: number;
  title: string;
}>;

export type LiveRunGroup = LiveGroupBase &
  Readonly<{
    kind: 'run' | 'orchestrated';
    entry: TimelineRunEntry;
    counts: RunStepCounts;
    stepStates: ReadonlyArray<RunStepState>;
    doneCount: number;
    currentStep: LiveRunStep | null;
    waitingStepNumber: number | null;
    failedStep: LiveRunStep | null;
    isDeciding: boolean;
    children: ReadonlyArray<LiveChild>;
  }>;

export type LiveAutoGroup = LiveGroupBase &
  Readonly<{
    kind: 'auto';
    group: AutoGroup;
    treePhase: AutoPhase;
    counts: null;
    children: AutoGroup['children'];
  }>;

export type LiveAgentGroup = LiveGroupBase &
  Readonly<{
    kind: 'agent';
    entry: TimelineAgentEntry;
    rowState: RowState;
    counts: null;
    children: ReadonlyArray<LiveChild>;
  }>;

export type LiveGroupModel = LiveRunGroup | LiveAutoGroup | LiveAgentGroup;

type Params = {
  readonly model: SessionWorkModel;
  readonly agents: ReadonlyArray<Agent>;
  readonly now: number;
};

type TimeParams = {
  readonly value: string | undefined;
};

const timeOf = ({ value }: TimeParams): number => {
  if (value === undefined) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

type MountParams = {
  readonly agents: ReadonlyArray<Agent>;
};

const mountIdOf = ({ agents }: MountParams): MountId | null => {
  const ids = new Set<MountId>();
  for (const agent of agents) {
    if (agent.mountId === undefined) {
      return null;
    }
    ids.add(agent.mountId);
  }
  const [only] = [...ids];
  return ids.size === 1 && only !== undefined ? only : null;
};

type FlatParams = {
  readonly entries: ReadonlyArray<TimelineAgentEntry>;
};

const flatAgentsOf = ({ entries }: FlatParams): ReadonlyArray<Agent> =>
  entries.flatMap((entry) => [entry.agent, ...flatAgentsOf({ entries: entry.children })]);

type PhaseParams = {
  readonly phase: RowPhase;
};

const stateOfPhase = ({ phase }: PhaseParams): LiveGroupState | null => {
  switch (phase) {
    case 'running':
      return 'working';
    case 'waiting':
      return 'waiting';
    case 'failed':
      return 'stuck';
    case 'queued':
    case 'done':
    case 'closed':
    case 'skipped':
      return null;
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
};

type ChildParams = {
  readonly entry: TimelineAgentEntry;
};

const childOf = ({ entry }: ChildParams): LiveChild => ({
  agentId: entry.agent.id,
  agentKind: entry.agentKind,
  title: entry.agent.name,
  phase: resolveAgentRowState({
    agent: entry.agent,
    isAsking: entry.openQuestions.length > 0,
    question: null,
    isReadyStep: false,
  }).phase,
});

type LiveChildrenParams = {
  readonly entries: ReadonlyArray<TimelineAgentEntry>;
};

const withDescendantsOf = ({ entries }: LiveChildrenParams): ReadonlyArray<TimelineAgentEntry> =>
  entries.flatMap((entry) => [entry, ...withDescendantsOf({ entries: entry.children })]);

const liveChildrenOf = ({ entries }: LiveChildrenParams): ReadonlyArray<LiveChild> =>
  withDescendantsOf({ entries })
    .map((entry) => childOf({ entry }))
    .filter(
      (child) => child.phase === 'running' || child.phase === 'waiting' || child.phase === 'failed',
    );

type StepOfParams = {
  readonly steps: ReadonlyArray<Step>;
  readonly index: number;
};

const stepOf = ({ steps, index }: StepOfParams): LiveRunStep | null => {
  const step = steps[index];
  return step === undefined ? null : { number: index + 1, title: step.name };
};

type RunParams = {
  readonly entry: TimelineRunEntry;
  readonly rowState: RowState;
  readonly model: SessionWorkModel;
};

const runGroupOf = ({ entry, rowState, model }: RunParams): LiveRunGroup | null => {
  const baseState = stateOfPhase({ phase: rowState.phase });
  if (baseState === null) {
    return null;
  }
  const isDeciding = model.decidingRunIds.has(entry.run.id);
  const state = baseState === 'working' && isDeciding ? 'deciding' : baseState;
  const advance = model.advanceByRunId.get(entry.run.id) ?? null;
  const counts = runStepCounts({ entry });
  const stepStates = runStepStates({ entry, advance });
  const steps = entry.workflow.steps.filter((step) => step.deletedAt == null);
  const stepAgents = entry.children.flatMap((child) => (child.kind === 'agent' ? [child] : []));
  const runningIndex = steps.findIndex((step) =>
    stepAgents.some((child) => child.agent.stepId === step.id && child.agent.status === 'running'),
  );
  const startedIndex = counts.started === 0 ? -1 : Math.min(counts.started, steps.length) - 1;
  const currentIndex = runningIndex === -1 ? startedIndex : runningIndex;
  const waitingIndex = stepStates.indexOf('waiting');
  const failedIndex = stepStates.indexOf('failed');
  const runningEntries = stepAgents.filter((child) => child.agent.status === 'running');
  return {
    kind: runWorkflowKind({ workflow: entry.workflow }) === 'orchestrator' ? 'orchestrated' : 'run',
    id: entry.run.id,
    title: entry.run.title ?? entry.workflow.name,
    state,
    mountId: mountIdOf({ agents: flatAgentsOf({ entries: stepAgents }) }),
    startedAt: timeOf({ value: entry.run.createdAt ?? entry.at }),
    entry,
    counts,
    stepStates,
    doneCount: stepStates.filter((stepState) => stepState === 'done').length,
    currentStep: currentIndex === -1 ? null : stepOf({ steps, index: currentIndex }),
    waitingStepNumber: waitingIndex === -1 ? null : waitingIndex + 1,
    failedStep: failedIndex === -1 ? null : stepOf({ steps, index: failedIndex }),
    isDeciding,
    children: liveChildrenOf({ entries: runningEntries }),
  };
};

type AgentParams = {
  readonly entry: TimelineAgentEntry;
  readonly rowState: RowState;
};

const agentGroupOf = ({ entry, rowState }: AgentParams): LiveAgentGroup | null => {
  const state = stateOfPhase({ phase: rowState.phase });
  if (state === null) {
    return null;
  }
  return {
    kind: 'agent',
    id: entry.agent.id,
    title: entry.agent.name,
    state,
    mountId: mountIdOf({ agents: flatAgentsOf({ entries: [entry] }) }),
    startedAt: timeOf({ value: entry.agent.startedAt }),
    entry,
    rowState,
    counts: null,
    children: liveChildrenOf({ entries: entry.children }),
  };
};

type AutoParams = {
  readonly group: AutoGroup;
  readonly treePhase: AutoPhase;
  readonly agents: ReadonlyArray<Agent>;
};

const autoStateOf = ({ group }: Pick<AutoParams, 'group'>): LiveGroupState | null => {
  if (group.phase !== 'running' && group.phase !== 'waiting') {
    return null;
  }
  if (group.isStuck) {
    return 'stuck';
  }
  return group.phase === 'waiting' ? 'waiting' : 'working';
};

const autoGroupModelOf = ({ group, treePhase, agents }: AutoParams): LiveAutoGroup | null => {
  const state = autoStateOf({ group });
  if (state === null) {
    return null;
  }
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const owned = [group.rootAgentId, ...group.children.map((child) => child.agentId)].flatMap(
    (id) => {
      const agent = byId.get(id);
      return agent === undefined ? [] : [agent];
    },
  );
  return {
    kind: 'auto',
    id: group.rootAgentId,
    title: group.title ?? 'Auto',
    state,
    mountId: mountIdOf({ agents: owned }),
    startedAt: timeOf({ value: byId.get(group.rootAgentId)?.startedAt }),
    group,
    treePhase,
    counts: null,
    children: group.children,
  };
};

type RowStatesParams = {
  readonly model: SessionWorkModel;
};

const rowStatesOf = ({ model }: RowStatesParams): ReadonlyMap<string, RowState> => {
  const states = new Map<string, RowState>();
  const stream = buildTimelineStream({
    entries: model.entries,
    unreadAgentIds: model.unreadAgentIds,
    advanceByRunId: model.advanceByRunId,
    decidingRunIds: model.decidingRunIds,
    dayLabelFor: () => null,
    showQuestions: false,
    resolveFactsByAgentId: model.resolveFactsByAgentId,
    jobFactsByAgentId: model.jobFactsByAgentId,
    autoFactsByAgentId: model.autoFactsByAgentId,
  });
  for (const item of stream.items) {
    if (item.kind === 'row' && !states.has(item.entry.id)) {
      states.set(item.entry.id, item.rowState);
    }
  }
  return states;
};

type EntryParams = {
  readonly entry: TimelineTopLevelEntry;
  readonly rowState: RowState;
  readonly model: SessionWorkModel;
};

const groupOfEntry = ({ entry, rowState, model }: EntryParams): LiveGroupModel | null => {
  if (entry.kind === 'run') {
    return runGroupOf({ entry, rowState, model });
  }
  if (entry.kind === 'agent') {
    return agentGroupOf({ entry, rowState });
  }
  return null;
};

const compareGroups = (first: LiveGroupModel, second: LiveGroupModel): number =>
  first.startedAt - second.startedAt;

export const liveGroupsOf = ({ model, agents, now }: Params): ReadonlyArray<LiveGroupModel> => {
  const rowStates = rowStatesOf({ model });
  const autoRootIds = new Set<string>(model.autoTrees.map((view) => view.tree.rootAgentId));
  const fromEntries = model.entries.flatMap((entry) => {
    const rowState = rowStates.get(entry.id);
    if (rowState === undefined || (entry.kind === 'agent' && autoRootIds.has(entry.agent.id))) {
      return [];
    }
    const group = groupOfEntry({ entry, rowState, model });
    return group === null ? [] : [group];
  });
  const fromAuto = model.autoTrees.flatMap((view) => {
    const group = autoGroupOf({ view, agents, now });
    const live =
      group === null ? null : autoGroupModelOf({ group, treePhase: view.tree.phase, agents });
    return live === null ? [] : [live];
  });
  return [...fromEntries, ...fromAuto].sort(compareGroups);
};
