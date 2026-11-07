import type { Agent, OpenQuestion, Workflow, WorkflowRun } from '@goodboy/types';
import { isAgentStatusHalted, isAgentStatusSettled } from '@goodboy/core/workflows';
import type { DotState } from '@goodboy/ui';
import { NAMES } from '../../shared/utils/names';
import { workflowRunOpenQuestions } from '../context/openQuestionsGate';
import { isRunPaused } from './isRunPaused';
import { isWorkflowRunClosedByUser } from './isWorkflowRunClosedByUser';
import type { RunPrimaryKind } from './runPrimaryOf';
import { isRunHeldForPlan } from '../../store/slices/workflows/workflowPlanApproval';

export const READY_WORD = 'Ready';

export type RunWait = 'stopped' | 'limit' | 'go';

export type RunStateKind =
  | 'archived'
  | 'closed'
  | 'done'
  | 'paused'
  | 'plan-hold'
  | 'plan-revising'
  | 'stopping'
  | 'stopped'
  | 'limit'
  | 'failed-stop'
  | 'failed'
  | 'running'
  | 'question'
  | 'halted-blocked'
  | 'halted-failed'
  | 'after-run'
  | 'ready'
  | 'waits-go';

export type RunState = {
  readonly kind: RunStateKind;
  readonly word: string;
  readonly pageWord: string;
  readonly tone: DotState;
  readonly primary: RunPrimaryKind | null;
  readonly isNeedsYou: boolean;
  readonly wait: RunWait | null;
  readonly isContinuable: boolean;
};

type Facts = {
  readonly word: string;
  readonly pageWord?: string;
  readonly tone: DotState;
  readonly primary: RunPrimaryKind | null;
  readonly wait?: RunWait;
  readonly isContinuable?: boolean;
};

const FACTS = {
  archived: { word: 'Archived', tone: 'idle', primary: 'restore' },
  closed: { word: 'Stopped', tone: 'idle', primary: null },
  done: { word: 'Done', tone: 'done', primary: null },
  paused: { word: 'Paused', tone: 'idle', primary: 'resume' },
  'plan-hold': { word: 'Needs approval', tone: 'needsYou', primary: null },
  'plan-revising': { word: 'Running', tone: 'running', primary: null },
  stopping: { word: 'Stopping', tone: 'running', primary: null },
  stopped: { word: 'Stopped', tone: 'idle', primary: 'continue', isContinuable: true },
  limit: { word: 'Paused at the limit', tone: 'needsYou', primary: 'raise-cap', wait: 'limit' },
  'failed-stop': { word: NAMES.failed, tone: 'failed', primary: 'retry', wait: 'stopped' },
  failed: { word: NAMES.failed, tone: 'failed', primary: 'retry' },
  running: { word: 'Running', tone: 'running', primary: null },
  question: { word: NAMES.needsYou, tone: 'needsYou', primary: 'answer' },
  'halted-blocked': {
    word: NAMES.notFinished,
    pageWord: NAMES.needsYou,
    tone: 'needsYou',
    primary: 'open-step',
    wait: 'stopped',
  },
  'halted-failed': {
    word: NAMES.failed,
    pageWord: NAMES.needsYou,
    tone: 'failed',
    primary: 'open-step',
    wait: 'stopped',
  },
  'after-run': { word: 'After previous', tone: 'idle', primary: null },
  ready: { word: READY_WORD, tone: 'idle', primary: null },
  'waits-go': { word: 'Waits for you', tone: 'needsYou', primary: 'decide-next', wait: 'go' },
} as const satisfies Readonly<Record<RunStateKind, Facts>>;

type KindParams = {
  readonly kind: RunStateKind;
  readonly predecessorName?: string;
};

export const runStateFromKind = ({ kind, predecessorName = 'previous' }: KindParams): RunState => {
  const facts: Facts = FACTS[kind];
  const word = kind === 'after-run' ? `After ${predecessorName}` : facts.word;
  return {
    kind,
    word,
    pageWord: facts.pageWord ?? word,
    tone: facts.tone,
    primary: facts.primary,
    isNeedsYou: facts.tone === 'needsYou',
    wait: facts.wait ?? null,
    isContinuable: facts.isContinuable ?? false,
  };
};

type PrimaryParams = {
  readonly primary: RunPrimaryKind;
};

const KIND_OF_PRIMARY: Readonly<Record<RunPrimaryKind, RunStateKind>> = {
  'review-plan': 'plan-hold',
  'approve-plan': 'plan-hold',
  answer: 'question',
  resume: 'paused',
  continue: 'stopped',
  retry: 'failed',
  hint: 'question',
  'raise-cap': 'limit',
  'decide-next': 'waits-go',
  'start-step': 'ready',
  'open-step': 'halted-blocked',
  'start-run': 'ready',
  restore: 'archived',
};

export const runStateOfPrimary = ({ primary }: PrimaryParams): RunState =>
  runStateFromKind({ kind: KIND_OF_PRIMARY[primary] });

type RunParams = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
};

export const stepAgentsOf = ({ agents }: Pick<RunParams, 'agents'>): ReadonlyArray<Agent> =>
  agents.filter((agent) => agent.parentAgentId == null);

export const isRunDone = ({ run, workflow, agents }: RunParams): boolean => {
  if (run.executionMode === 'dynamic') {
    return run.orchestrationOutcome === 'done';
  }
  const settled = stepAgentsOf({ agents }).filter((agent) =>
    isAgentStatusSettled({ status: agent.status }),
  ).length;
  return workflow.steps.length > 0 && settled >= workflow.steps.length;
};

type Params = RunParams & {
  readonly predecessorName: string;
  readonly isOrchestrating: boolean;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly isPlanRevising: boolean;
};

const kindOf = ({
  run,
  workflow,
  agents,
  isOrchestrating,
  questions,
  isPlanRevising,
}: Params): RunStateKind => {
  if (run.discardedAt != null) {
    return 'archived';
  }
  if (isWorkflowRunClosedByUser({ run })) {
    return 'closed';
  }
  if (isRunDone({ run, workflow, agents })) {
    return 'done';
  }
  const isRunning = agents.some((agent) => agent.status === 'running');
  const stop = run.orchestrationStop ?? null;
  if (isRunPaused({ run })) {
    return 'paused';
  }
  if (isRunHeldForPlan({ run })) {
    return isPlanRevising ? 'plan-revising' : 'plan-hold';
  }
  if (stop?.kind === 'operator') {
    return isOrchestrating || isRunning ? 'stopping' : 'stopped';
  }
  if (stop?.kind === 'budget' && !isRunning) {
    return 'limit';
  }
  if (stop !== null && !isRunning) {
    return stop.kind === 'failure' ? 'failed-stop' : 'failed';
  }
  if (isRunning || isOrchestrating) {
    return 'running';
  }
  if (workflowRunOpenQuestions({ questions, run }).length > 0) {
    return 'question';
  }
  const halted = agents.find((agent) => isAgentStatusHalted({ status: agent.status }));
  if (halted !== undefined) {
    return halted.status === 'blocked' ? 'halted-blocked' : 'halted-failed';
  }
  if (agents.length === 0 && run.triggerMode === 'after_run') {
    return 'after-run';
  }
  if (agents.every((agent) => agent.status === 'pending')) {
    return 'ready';
  }
  return 'waits-go';
};

export const runStateOf = ({ predecessorName, ...facts }: Params): RunState =>
  runStateFromKind({ kind: kindOf({ ...facts, predecessorName }), predecessorName });
