import type {
  Agent,
  AgentId,
  OpenQuestion,
  RunRoute,
  SessionMountView,
  TurnEvent,
  TurnState,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { agentStateOf } from '../workTreeModel/agentStateOf';
import { NAMES } from '../../shared/utils/names';
import { agentHasUnread } from '../../store/slices/agents/agentHasUnread';
import { runKindLineOf } from './startKind/runKindLineOf';
import type { DotState } from '@goodboy/ui';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { autoDotOf } from '../auto/autoDotOf';
import { autoTreeWordOf, type AutoTreeWord } from '../auto/autoTreeWordOf';
import type { AttachedRun } from '../workflows/activeWorkflowRuns';
import { splitWorkflowRuns } from '../workflows/activeWorkflowRuns';
import { cutStepIdOf } from '../workflows/cutStepIdOf';
import { runRowFactsOf, type RunRowFacts } from '../workflows/runRowFactsOf';
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
import { agentThreadIds } from './agentThreadIds';
import { commentRunOriginOf } from './commentRunOriginOf';
import { descendantAgentsOf } from './descendantAgentsOf';
import { runAgentCountOf } from './runAgentCountOf';
import { placedAgentsOf } from './placedAgentsOf';
import { workBranchesOf, type WorkBranch, type WorkBranchProject } from './workBranchesOf';

type SessionRunKind = 'preset' | 'orchestrated' | 'auto' | 'agent';

type SessionRunShape = 'plan' | 'lead';

type SessionRunOpen = Readonly<
  | { kind: 'run'; runId: WorkflowRunId }
  | { kind: 'auto'; agentId: AgentId }
  | { kind: 'agent'; agentId: AgentId }
>;

export type SessionRunVerb = Readonly<
  | { kind: 'continue'; agentId: AgentId }
  | { kind: 'start'; agentId: AgentId }
  | { kind: 'continueRun'; runId: WorkflowRunId }
  | { kind: 'startRun'; runId: WorkflowRunId }
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
  isOlderRun: boolean;
  progress: string;
  startedAt: number;
  revisingSince: number | null;
  agentIds: ReadonlyArray<AgentId>;
  open: SessionRunOpen;
  verb: SessionRunVerb | null;
  branches: ReadonlyArray<WorkBranch>;
  goneBranches: ReadonlyArray<WorkBranch>;
}>;

type SessionRunRow = Omit<SessionRun, 'branches' | 'goneBranches'>;

type Params = {
  readonly attachedRuns: ReadonlyArray<AttachedRun>;
  readonly agents: ReadonlyArray<Agent>;
  readonly kindOverride: Readonly<Record<string, AgentKind>>;
  readonly autoViews: ReadonlyArray<AutoTreeView>;
  readonly orchestrating: Readonly<Record<string, boolean>> | undefined;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly rootTurns: Readonly<Record<string, TurnState | undefined>>;
  readonly turnByAgentId: ReadonlyMap<string, TurnState>;
  readonly revisingStarts: Readonly<Record<string, number>>;
  readonly mounts: ReadonlyArray<SessionMountView>;
  readonly projects: ReadonlyArray<WorkBranchProject>;
  readonly routes?: Readonly<Record<string, RunRoute>>;
  readonly commentPlaces?: Readonly<Record<string, string>>;
};

const NO_ROUTES: Readonly<Record<string, RunRoute>> = {};

const NO_PLACES: Readonly<Record<string, string>> = {};

type OriginParams = {
  readonly agent: Agent;
  readonly places: Readonly<Record<string, string>>;
  readonly fallback: () => string;
};

const originOf = ({ agent, places, fallback }: OriginParams): string =>
  agent.sourceKind === 'comment_run'
    ? commentRunOriginOf({ threadIds: agentThreadIds(agent), places })
    : fallback();

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_EVENTS: ReadonlyArray<TurnEvent> = [];

const IN_PROGRESS_DOTS: ReadonlySet<DotState> = new Set<DotState>([
  'running',
  'needsYou',
  'failed',
]);

const WAITING_DOTS: ReadonlySet<DotState> = new Set<DotState>(['needsYou', 'failed']);

const FINISHED_DOTS: ReadonlySet<DotState> = new Set<DotState>(['done', 'stopped']);

const ORCHESTRATED_LINE = runKindLineOf({ line: { kind: 'orchestrated' } });

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

type StartParams = {
  readonly agents: ReadonlyArray<Agent>;
};

const startVerbOf = ({ agents }: StartParams): SessionRunVerb | null => {
  const next = agents
    .filter((agent) => agent.status === 'pending' && agent.parentAgentId == null)
    .sort((left, right) => left.ordinal - right.ordinal)[0];
  return next === undefined ? null : { kind: 'start', agentId: next.id };
};

type ContinueAgentParams = {
  readonly agent: Agent;
};

const continueAgentVerbOf = ({ agent }: ContinueAgentParams): SessionRunVerb | null =>
  agent.status === 'stopped' && agent.doneAt == null
    ? { kind: 'continue', agentId: agent.id }
    : null;

type WorkflowVerbParams = {
  readonly run: WorkflowRun;
  readonly facts: RunRowFacts;
  readonly stepAgents: ReadonlyArray<Agent>;
};

const continueRunVerbOf = ({
  run,
  stepAgents,
}: Omit<WorkflowVerbParams, 'facts'>): SessionRunVerb | null => {
  const cutStepId = cutStepIdOf({ agents: stepAgents, workflowRunId: run.id });
  if (cutStepId !== null) {
    return { kind: 'continue', agentId: cutStepId };
  }
  if (run.executionMode === 'dynamic') {
    return { kind: 'continueRun', runId: run.id };
  }
  return startVerbOf({ agents: stepAgents });
};

const workflowVerbOf = ({ run, facts, stepAgents }: WorkflowVerbParams): SessionRunVerb | null => {
  if (facts.isQueuedManual) {
    return { kind: 'startRun', runId: run.id };
  }
  if (facts.isStartable) {
    return startVerbOf({ agents: stepAgents });
  }
  return facts.isContinuable ? continueRunVerbOf({ run, stepAgents }) : null;
};

type WorkflowRowsParams = Pick<
  Params,
  'attachedRuns' | 'agents' | 'orchestrating' | 'questions' | 'revisingStarts'
>;

const workflowRowsOf = ({
  attachedRuns,
  agents,
  orchestrating,
  questions,
  revisingStarts,
}: WorkflowRowsParams): ReadonlyArray<SessionRunRow> => {
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
      isPlanRevising: revisingStarts[run.id] !== undefined,
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
        ? ORCHESTRATED_LINE
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
      isOlderRun: isOrchestrated,
      progress: facts.progress,
      startedAt: timeOf({ value: run.createdAt }),
      revisingSince: revisingStarts[run.id] ?? null,
      agentIds,
      open: { kind: 'run', runId: run.id },
      verb: workflowVerbOf({ run, facts, stepAgents }),
    };
  });
};

type AutoRowParams = {
  readonly root: Agent;
  readonly agents: ReadonlyArray<Agent>;
  readonly autoViews: ReadonlyArray<AutoTreeView>;
  readonly rootTurns: Params['rootTurns'];
  readonly route: RunRoute | null;
  readonly places: Readonly<Record<string, string>>;
};

type RestingParams = {
  readonly root: Agent;
};

const restingWordOf = ({ root }: RestingParams): Pick<AutoTreeWord, 'state' | 'word'> => {
  if (root.status === 'running') {
    return { state: 'running', word: NAMES.running };
  }
  return { state: 'idle', word: NAMES.idle };
};

const autoRowOf = ({
  root,
  agents,
  autoViews,
  rootTurns,
  route,
  places,
}: AutoRowParams): SessionRunRow => {
  const view = autoViews.find((candidate) => candidate.tree.rootAgentId === root.id);
  const state =
    view === undefined
      ? restingWordOf({ root })
      : autoTreeWordOf({ view, rootTurn: rootTurns[root.id] ?? null });
  const dot = autoDotOf({ state: state.state });
  const children = descendantAgentsOf({ agents, rootId: root.id });
  const agentIds = [root.id, ...children.map((child) => child.id)];
  return {
    id: root.id,
    kind: 'auto',
    shape: 'lead',
    title: autoRootTitleOf({ name: root.name, ask: view?.rootAsk ?? null, events: NO_EVENTS }),
    origin: originOf({
      agent: root,
      places,
      fallback: () =>
        runKindLineOf({ line: { kind: 'lead', planName: route?.presetName ?? null } }),
    }),
    dot,
    stateWord: state.word,
    ...progressStateOf({ dot }),
    isArchived: false,
    isFinished: FINISHED_DOTS.has(dot),
    isUnread: isUnreadOf({ agents, agentIds }),
    isRestartStopped: false,
    isOlderRun: false,
    progress: agentCountLabelOf({
      count: runAgentCountOf({ agentIds: children.map((child) => child.id) }),
    }),
    startedAt: view === undefined ? timeOf({ value: root.startedAt }) : view.tree.createdAt,
    revisingSince: null,
    agentIds,
    open: { kind: 'auto', agentId: root.id },
    verb: dot === 'stopped' ? continueAgentVerbOf({ agent: root }) : null,
  };
};

type AgentRowParams = {
  readonly agent: Agent;
  readonly kind: AgentKind;
  readonly agents: ReadonlyArray<Agent>;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly turn: TurnState | undefined;
  readonly places: Readonly<Record<string, string>>;
};

const agentRowOf = ({
  agent,
  kind,
  agents,
  questions,
  turn,
  places,
}: AgentRowParams): SessionRunRow => {
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
    origin: originOf({
      agent,
      places,
      fallback: () =>
        runKindLineOf({ line: { kind: 'agent', role: agentKindPalette({ kind }).label } }),
    }),
    dot: state.dot,
    stateWord: state.word,
    ...progressStateOf({ dot: state.dot }),
    isArchived: false,
    isFinished: state.isFinished,
    isUnread: isUnreadOf({ agents, agentIds }),
    isRestartStopped: state.status === 'stopped' && !state.isFinished && agent.stoppedBy === 'app',
    isOlderRun: false,
    progress: agentCountLabelOf({ count: runAgentCountOf({ agentIds }) }),
    startedAt: timeOf({ value: agent.startedAt }),
    revisingSince: null,
    agentIds,
    open: { kind: 'agent', agentId: agent.id },
    verb: state.word === NAMES.stopped ? continueAgentVerbOf({ agent }) : null,
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
  revisingStarts,
  mounts,
  projects,
  routes = NO_ROUTES,
  commentPlaces = NO_PLACES,
}: Params): ReadonlyArray<SessionRun> => {
  const standalone = agents.filter((agent) => isStandaloneAgent({ agent }));
  const kinds = standalone.map((agent) => ({
    agent,
    kind: classifyAgent({ agent, override: kindOverride[agent.id] ?? null }),
  }));
  const autoRows = kinds
    .filter(({ kind }) => kind === 'auto')
    .map(({ agent }) =>
      autoRowOf({
        root: agent,
        agents,
        autoViews,
        rootTurns,
        route: routes[agent.id] ?? null,
        places: commentPlaces,
      }),
    );
  const agentRows = kinds
    .filter(({ kind }) => isAgentsPageKind({ kind }))
    .map(({ agent, kind }) =>
      agentRowOf({
        agent,
        kind,
        agents,
        questions,
        turn: turnByAgentId.get(agent.id),
        places: commentPlaces,
      }),
    );
  const placedAgents = placedAgentsOf({ agents, autoViews, mounts });
  return [
    ...workflowRowsOf({ attachedRuns, agents, orchestrating, questions, revisingStarts }),
    ...autoRows,
    ...agentRows,
  ]
    .map((row) => {
      const branches = workBranchesOf({
        agentIds: row.agentIds,
        agents: placedAgents,
        mounts,
        projects,
      });
      const touched = workBranchesOf({
        agentIds: row.agentIds,
        agents: placedAgents,
        mounts,
        projects,
        isDetachedIncluded: true,
      });
      return {
        ...row,
        branches,
        goneBranches: touched.filter(
          (branch) => !branches.some((attached) => attached.mountId === branch.mountId),
        ),
      };
    })
    .sort(compareRuns);
};
