import type {
  Agent,
  AgentId,
  OpenQuestion,
  TurnEvent,
  TurnState,
  WorkflowRunId,
} from '@goodboy/types';
import { agentStateOf } from '../workTreeModel/agentStateOf';
import { agentHasUnread } from '../../store/slices/agents/agentHasUnread';
import { runKindLineOf } from './startKind/runKindLineOf';
import type { DotState } from '@goodboy/ui';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { autoTreeWordOf } from '../auto/autoTreeWordOf';
import type { AttachedRun } from '../workflows/activeWorkflowRuns';
import { splitWorkflowRuns } from '../workflows/activeWorkflowRuns';
import { runRowFactsOf } from '../workflows/runRowFactsOf';
import { workflowKindName } from '../workflows/workflowKindName';
import {
  agentKindPalette,
  classifyAgent,
  isAgentsPageKind,
  isStandaloneAgent,
  type AgentKind,
} from './agent-kind';
import { autoRootTitleOf } from './components/AutoAgentsPane/autoRootTitleOf';
import { agentCountLabelOf } from './agentCountLabelOf';
import { descendantAgentsOf } from './descendantAgentsOf';
import { runAgentCountOf } from './runAgentCountOf';

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
  isUnread: boolean;
  isRestartStopped: boolean;
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
  readonly turnByAgentId: ReadonlyMap<string, TurnState>;
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
  orchestrated: runKindLineOf({ line: { kind: 'orchestrated' } }),
  auto: runKindLineOf({ line: { kind: 'autoAgent' } }),
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

type StateParams = {
  readonly dot: DotState;
};

const progressStateOf = ({ dot }: StateParams) => ({
  isInProgress: IN_PROGRESS_DOTS.has(dot),
  isWaiting: WAITING_DOTS.has(dot),
});

type UnreadParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly agentIds: ReadonlyArray<AgentId>;
};

const isUnreadOf = ({ agents, agentIds }: UnreadParams): boolean =>
  agents.some((agent) => agentIds.includes(agent.id) && agentHasUnread(agent, false));

type WorkflowRowsParams = Pick<Params, 'attachedRuns' | 'agents' | 'orchestrating' | 'questions'>;

const workflowRowsOf = ({
  attachedRuns,
  agents,
  orchestrating,
  questions,
}: WorkflowRowsParams): ReadonlyArray<SessionRun> => {
  const { agentsByRunId } = splitWorkflowRuns({ attachedRuns, agents });
  const nameByRunId = new Map(
    attachedRuns.map(({ run, workflow }) => [run.id, run.title ?? workflowKindName({ workflow })]),
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
    const agentIds = agents
      .filter((agent) => agent.workflowRunId === run.id)
      .map((agent) => agent.id);
    return {
      id: run.id,
      kind: isOrchestrated ? 'orchestrated' : 'preset',
      shape: 'plan',
      title: nameByRunId.get(run.id) ?? workflowKindName({ workflow }),
      origin: isOrchestrated
        ? ORIGIN.orchestrated
        : runKindLineOf({
            line: { kind: 'preset', presetName: workflowKindName({ workflow }) },
          }),
      dot: facts.dot,
      stateWord: facts.word,
      ...(isArchived ? { isInProgress: false, isWaiting: false } : progressStateOf(facts)),
      isArchived,
      isFinished: !facts.isActive,
      isUnread: isUnreadOf({ agents, agentIds }),
      isRestartStopped: false,
      progress: facts.progress,
      startedAt: timeOf({ value: run.createdAt }),
      agentIds,
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
  const children = descendantAgentsOf({ agents, rootId: root.id });
  const agentIds = [root.id, ...children.map((child) => child.id)];
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
    isUnread: isUnreadOf({ agents, agentIds }),
    isRestartStopped: false,
    progress: agentCountLabelOf({
      count: runAgentCountOf({ agentIds: children.map((child) => child.id) }),
    }),
    startedAt: view === undefined ? timeOf({ value: root.startedAt }) : view.tree.createdAt,
    agentIds,
    open: { kind: 'auto', agentId: root.id },
  };
};

type AgentRowParams = {
  readonly agent: Agent;
  readonly kind: AgentKind;
  readonly agents: ReadonlyArray<Agent>;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly turn: TurnState | undefined;
};

const agentRowOf = ({ agent, kind, agents, questions, turn }: AgentRowParams): SessionRun => {
  const state = agentStateOf({
    agent,
    turn,
    openQuestions: questions.filter(
      (question) => question.status === 'open' && question.createdByAgentId === agent.id,
    ),
  });
  const children = descendantAgentsOf({ agents, rootId: agent.id });
  const agentIds = [agent.id, ...children.map((child) => child.id)];
  return {
    id: agent.id,
    kind: 'agent',
    shape: 'lead',
    title: agent.name,
    origin: runKindLineOf({ line: { kind: 'agent', role: agentKindPalette({ kind }).label } }),
    dot: state.dot,
    stateWord: state.word,
    ...progressStateOf({ dot: state.dot }),
    isArchived: false,
    isFinished: state.isFinished,
    isUnread: isUnreadOf({ agents, agentIds }),
    isRestartStopped: state.status === 'stopped' && !state.isFinished && agent.stoppedBy === 'app',
    progress: agentCountLabelOf({ count: runAgentCountOf({ agentIds }) }),
    startedAt: timeOf({ value: agent.startedAt }),
    agentIds,
    open: { kind: 'agent', agentId: agent.id },
  };
};

type RankParams = {
  readonly run: SessionRun;
};

const rankOf = ({ run }: RankParams): number => {
  if (run.isFinished) {
    return run.isUnread ? 3 : 4;
  }
  if (run.dot === 'needsYou' || run.dot === 'failed') {
    return 0;
  }
  return run.dot === 'running' ? 1 : 2;
};

const compareRuns = (first: SessionRun, second: SessionRun): number => {
  const rankGap = rankOf({ run: first }) - rankOf({ run: second });
  return rankGap === 0 ? second.startedAt - first.startedAt : rankGap;
};

export const sessionRunsOf = ({
  attachedRuns,
  agents,
  kindOverride,
  autoViews,
  orchestrating,
  questions,
  rootTurns,
  turnByAgentId,
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
    .map(({ agent, kind }) =>
      agentRowOf({ agent, kind, agents, questions, turn: turnByAgentId.get(agent.id) }),
    );
  return [
    ...workflowRowsOf({ attachedRuns, agents, orchestrating, questions }),
    ...autoRows,
    ...agentRows,
  ].sort(compareRuns);
};
