import type {
  Agent,
  AgentId,
  OpenQuestion,
  TurnEvent,
  TurnState,
  WorkflowRunId,
} from '@goodboy/types';
import type { DotState } from '@goodboy/ui';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { autoTreeWordOf } from '../auto/autoTreeWordOf';
import type { AttachedRun } from '../workflows/activeWorkflowRuns';
import { splitWorkflowRuns } from '../workflows/activeWorkflowRuns';
import { runRowFactsOf } from '../workflows/runRowFactsOf';
import { workflowKindName } from '../workspace/components/WorkspacesSidebar/lib';
import {
  agentKindPalette,
  classifyAgent,
  isAgentsPageKind,
  isStandaloneAgent,
  type AgentKind,
} from './agent-kind';
import { describeAgentStatus } from './agent-status';
import { autoRootTitleOf } from './components/AutoAgentsPane/autoRootTitleOf';

type SessionRunKind = 'preset' | 'orchestrated' | 'auto' | 'agent';

export type SessionRunShape = 'plan' | 'lead';

type SessionRunOpen = Readonly<
  | { kind: 'run'; runId: WorkflowRunId }
  | { kind: 'auto'; agentId: AgentId }
  | { kind: 'agent'; agentId: AgentId }
>;

export type SessionRun = Readonly<{
  id: string;
  kind: SessionRunKind;
  shape: SessionRunShape;
  title: string;
  origin: string;
  dot: DotState;
  stateWord: string;
  isInProgress: boolean;
  isWaiting: boolean;
  isArchived: boolean;
  isFinished: boolean;
  progress: string;
  startedAt: number;
  agentIds: ReadonlyArray<AgentId>;
  open: SessionRunOpen;
}>;

type Params = {
  readonly attachedRuns: ReadonlyArray<AttachedRun>;
  readonly agents: ReadonlyArray<Agent>;
  readonly kindOverride: Readonly<Record<string, AgentKind>>;
  readonly autoViews: ReadonlyArray<AutoTreeView>;
  readonly orchestrating: Readonly<Record<string, boolean>> | undefined;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly rootTurns: Readonly<Record<string, TurnState | undefined>>;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_EVENTS: ReadonlyArray<TurnEvent> = [];

const IN_PROGRESS_DOTS: ReadonlySet<DotState> = new Set<DotState>([
  'running',
  'needsYou',
  'failed',
]);

const WAITING_DOTS: ReadonlySet<DotState> = new Set<DotState>(['needsYou', 'failed']);

const FINISHED_DOTS: ReadonlySet<DotState> = new Set<DotState>(['done', 'stopped']);

const ORIGIN = {
  orchestrated: 'Was an orchestrated run',
  auto: 'Was an Auto conversation',
} as const;

type TimeParams = {
  readonly value: string | number | null | undefined;
};

const timeOf = ({ value }: TimeParams): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

type CountParams = {
  readonly count: number;
  readonly noun: string;
};

const countWordOf = ({ count, noun }: CountParams): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

type StateParams = {
  readonly dot: DotState;
};

const progressStateOf = ({ dot }: StateParams) => ({
  isInProgress: IN_PROGRESS_DOTS.has(dot),
  isWaiting: WAITING_DOTS.has(dot),
});

type DescendantParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly rootId: AgentId;
};

const descendantsOf = ({ agents, rootId }: DescendantParams): ReadonlyArray<Agent> => {
  const found: Array<Agent> = [];
  const seen = new Set<string>([rootId]);
  let frontier: ReadonlyArray<string> = [rootId];
  while (frontier.length > 0) {
    const children = agents.filter(
      (agent) =>
        agent.parentAgentId != null &&
        frontier.includes(agent.parentAgentId) &&
        !seen.has(agent.id),
    );
    for (const child of children) {
      seen.add(child.id);
      found.push(child);
    }
    frontier = children.map((child) => child.id);
  }
  return found;
};

type WorkflowRowsParams = Pick<Params, 'attachedRuns' | 'agents' | 'orchestrating' | 'questions'>;

const workflowRowsOf = ({
  attachedRuns,
  agents,
  orchestrating,
  questions,
}: WorkflowRowsParams): ReadonlyArray<SessionRun> => {
  const { agentsByRunId } = splitWorkflowRuns({ attachedRuns, agents });
  const nameByRunId = new Map(
    attachedRuns.map(({ run, workflow }) => [run.id, run.title ?? workflowKindName(workflow)]),
  );
  return attachedRuns.map(({ run, workflow }) => {
    const stepAgents = agentsByRunId.get(run.id) ?? NO_AGENTS;
    const facts = runRowFactsOf({
      run,
      workflow,
      agents: stepAgents,
      predecessorName:
        run.chainAfterId == null ? 'previous' : (nameByRunId.get(run.chainAfterId) ?? 'previous'),
      isOrchestrating: orchestrating?.[run.id] ?? false,
      questions,
    });
    const isOrchestrated = run.executionMode === 'dynamic';
    const isArchived = run.discardedAt != null;
    return {
      id: run.id,
      kind: isOrchestrated ? 'orchestrated' : 'preset',
      shape: 'plan',
      title: nameByRunId.get(run.id) ?? workflowKindName(workflow),
      origin: isOrchestrated
        ? ORIGIN.orchestrated
        : `Was a preset run · ${workflowKindName(workflow)}`,
      dot: facts.dot,
      stateWord: facts.word,
      ...(isArchived ? { isInProgress: false, isWaiting: false } : progressStateOf(facts)),
      isArchived,
      isFinished: !facts.isActive,
      progress: facts.progress,
      startedAt: timeOf({ value: run.createdAt }),
      agentIds: agents.filter((agent) => agent.workflowRunId === run.id).map((agent) => agent.id),
      open: { kind: 'run', runId: run.id },
    };
  });
};

type AutoDotParams = {
  readonly word: string;
  readonly node: string;
};

const autoDotOf = ({ word, node }: AutoDotParams): DotState => {
  if (word === 'Needs you') {
    return 'needsYou';
  }
  if (node === 'running') {
    return 'running';
  }
  if (node === 'done') {
    return 'done';
  }
  if (node === 'stopped') {
    return 'stopped';
  }
  return 'idle';
};

type AutoRowParams = {
  readonly root: Agent;
  readonly agents: ReadonlyArray<Agent>;
  readonly autoViews: ReadonlyArray<AutoTreeView>;
  readonly rootTurns: Params['rootTurns'];
};

const autoRowOf = ({ root, agents, autoViews, rootTurns }: AutoRowParams): SessionRun => {
  const view = autoViews.find((candidate) => candidate.tree.rootAgentId === root.id);
  const resting =
    root.status === 'running'
      ? { word: 'Running', node: 'running' }
      : { word: 'Idle', node: 'queued' };
  const state =
    view === undefined ? resting : autoTreeWordOf({ view, rootTurn: rootTurns[root.id] ?? null });
  const dot = autoDotOf(state);
  const children = descendantsOf({ agents, rootId: root.id });
  return {
    id: root.id,
    kind: 'auto',
    shape: 'lead',
    title: autoRootTitleOf({ name: root.name, ask: view?.rootAsk ?? null, events: NO_EVENTS }),
    origin: ORIGIN.auto,
    dot,
    stateWord: state.word,
    ...progressStateOf({ dot }),
    isArchived: false,
    isFinished: FINISHED_DOTS.has(dot),
    progress: children.length === 0 ? '' : countWordOf({ count: children.length, noun: 'agent' }),
    startedAt: view === undefined ? timeOf({ value: root.startedAt }) : view.tree.createdAt,
    agentIds: [root.id, ...children.map((child) => child.id)],
    open: { kind: 'auto', agentId: root.id },
  };
};

type AgentDotParams = {
  readonly agent: Agent;
  readonly hasQuestion: boolean;
};

const agentDotOf = ({ agent, hasQuestion }: AgentDotParams): DotState => {
  if (agent.doneAt != null) {
    return agent.status === 'completed' ? 'done' : 'stopped';
  }
  if (hasQuestion) {
    return 'needsYou';
  }
  switch (agent.status) {
    case 'running':
      return 'running';
    case 'completed':
      return 'done';
    case 'failed':
    case 'blocked':
      return 'failed';
    case 'stopped':
    case 'skipped':
      return 'stopped';
    case 'pending':
      return 'idle';
    default: {
      const unreachable: never = agent.status;
      return unreachable;
    }
  }
};

type AgentRowParams = {
  readonly agent: Agent;
  readonly kind: AgentKind;
  readonly agents: ReadonlyArray<Agent>;
  readonly questions: ReadonlyArray<OpenQuestion>;
};

const agentRowOf = ({ agent, kind, agents, questions }: AgentRowParams): SessionRun => {
  const hasQuestion = questions.some(
    (question) => question.status === 'open' && question.createdByAgentId === agent.id,
  );
  const dot = agentDotOf({ agent, hasQuestion });
  const children = descendantsOf({ agents, rootId: agent.id });
  const count = children.length + 1;
  return {
    id: agent.id,
    kind: 'agent',
    shape: 'lead',
    title: agent.name,
    origin: `Was an agent · ${agentKindPalette({ kind }).label}`,
    dot,
    stateWord: hasQuestion ? 'Needs you' : describeAgentStatus({ status: agent.status }).label,
    ...progressStateOf({ dot }),
    isArchived: false,
    isFinished: FINISHED_DOTS.has(dot),
    progress: countWordOf({ count, noun: 'agent' }),
    startedAt: timeOf({ value: agent.startedAt }),
    agentIds: [agent.id, ...children.map((child) => child.id)],
    open: { kind: 'agent', agentId: agent.id },
  };
};

const compareRuns = (first: SessionRun, second: SessionRun): number =>
  second.startedAt - first.startedAt;

export const sessionRunsOf = ({
  attachedRuns,
  agents,
  kindOverride,
  autoViews,
  orchestrating,
  questions,
  rootTurns,
}: Params): ReadonlyArray<SessionRun> => {
  const standalone = agents.filter((agent) => isStandaloneAgent({ agent }));
  const kinds = standalone.map((agent) => ({
    agent,
    kind: classifyAgent({ agent, override: kindOverride[agent.id] ?? null }),
  }));
  const autoRows = kinds
    .filter(({ kind }) => kind === 'auto')
    .map(({ agent }) => autoRowOf({ root: agent, agents, autoViews, rootTurns }));
  const agentRows = kinds
    .filter(({ kind }) => isAgentsPageKind({ kind }))
    .map(({ agent, kind }) => agentRowOf({ agent, kind, agents, questions }));
  return [
    ...workflowRowsOf({ attachedRuns, agents, orchestrating, questions }),
    ...autoRows,
    ...agentRows,
  ].sort(compareRuns);
};
