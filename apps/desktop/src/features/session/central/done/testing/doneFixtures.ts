import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type SessionEvent,
  type SessionEventId,
  type SessionEventPayload,
  type SessionId,
  type Step,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import {
  buildTimelineGroups,
  type TimelineTopLevelEntry,
} from '../../../timeline/buildTimelineGroups';
import type { DoneModel, DoneSource } from '../doneTypes';

export const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
export const RUN_ID = brandId<WorkflowRunId>({ value: 'run-build' });
export const NOW = new Date(2026, 9, 18, 12, 0);

type AtParams = {
  readonly day?: number;
  readonly hour: number;
  readonly minute?: number;
};

export const at = ({ day = 18, hour, minute = 0 }: AtParams): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(2026, 9, day, hour, minute).toISOString() });

type StepAgentParams = {
  readonly index: number;
  readonly status?: Agent['status'];
  readonly summary?: string;
  readonly day?: number;
  readonly runId?: WorkflowRunId;
};

export const stepAgent = ({
  index,
  status = 'completed',
  summary,
  day = 18,
  runId = RUN_ID,
}: StepAgentParams): Agent => ({
  id: brandId<AgentId>({ value: `agent-step-${index}` }),
  sessionId: SESSION_ID,
  stepId: brandId<StepId>({ value: `step-${index}` }),
  workflowRunId: runId,
  ordinal: index,
  name: `Step ${index} agent`,
  kind: index === 1 ? 'implementer' : 'tester',
  status,
  ...(summary === undefined ? {} : { outputSummary: summary }),
  ...(status === 'pending' ? {} : { startedAt: at({ day, hour: 9, minute: index * 5 }) }),
  ...(status === 'completed' ? { completedAt: at({ day, hour: 9, minute: index * 5 + 3 }) } : {}),
});

type WorkflowParams = {
  readonly total: number;
  readonly isOrchestrated?: boolean;
  readonly summary?: string;
};

export const workflowOf = ({
  total,
  isOrchestrated = false,
  summary,
}: WorkflowParams): { readonly run: WorkflowRun; readonly workflow: Workflow } => {
  const workflowId = brandId<WorkflowId>({ value: 'workflow-build' });
  const steps: ReadonlyArray<Step> = Array.from({ length: total }, (_, offset) => ({
    id: brandId<StepId>({ value: `step-${offset + 1}` }),
    workflowId,
    ordinal: offset,
    name: `Step ${offset + 1}`,
    promptPrefix: '',
  }));
  return {
    run: {
      id: RUN_ID,
      workflowId,
      ordinal: 0,
      currentStep: 0,
      autoRun: true,
      triggerMode: 'immediate',
      executionMode: isOrchestrated ? 'dynamic' : 'static',
      ...(isOrchestrated ? { orchestrationOutcome: 'done' as const } : {}),
      ...(summary === undefined ? {} : { orchestratorSummary: summary }),
      createdAt: at({ hour: 8 }),
    },
    workflow: {
      id: workflowId,
      workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
      name: 'Build',
      description: '',
      ...(isOrchestrated ? { origin: 'orchestrated' as const } : {}),
      steps,
      createdAt: at({ hour: 8 }),
      updatedAt: at({ hour: 8 }),
    },
  };
};

type EventParams = {
  readonly id: string;
  readonly kind: SessionEvent['kind'];
  readonly payload?: SessionEventPayload;
  readonly createdAt?: IsoDateTime;
};

export const eventOf = ({
  id,
  kind,
  payload = {},
  createdAt = at({ hour: 9, minute: 12 }),
}: EventParams): SessionEvent => ({
  id: brandId<SessionEventId>({ value: id }),
  sessionId: SESSION_ID,
  kind,
  payload,
  createdAt,
});

type WorldParams = {
  readonly agents?: ReadonlyArray<Agent>;
  readonly runs?: ReadonlyArray<{ readonly run: WorkflowRun; readonly workflow: Workflow }>;
  readonly events?: ReadonlyArray<SessionEvent>;
  readonly autoTrees?: ReadonlyArray<AutoTreeView>;
  readonly checkNameByAgentId?: ReadonlyMap<string, string>;
};

export const modelOf = ({
  agents = [],
  runs = [],
  events = [],
  autoTrees = [],
  checkNameByAgentId = new Map(),
}: WorldParams): DoneModel => {
  const { entries } = buildTimelineGroups({
    sessionId: SESSION_ID,
    agents,
    workflows: runs,
    plans: [],
    artifacts: [],
    externalTasks: [],
    questions: [],
    worktrees: [],
    events,
    agentKindOverride: {},
  });
  return {
    entries,
    events,
    autoTrees,
    agents,
    checkNameByAgentId,
    turnFiles: new Map(),
    now: NOW.getTime(),
  };
};

export const sourceOf = ({
  model,
  id,
}: {
  readonly model: DoneModel;
  readonly id: string;
}): DoneSource => {
  const entry: TimelineTopLevelEntry | undefined = model.entries.find(
    (candidate) => candidate.id === id,
  );
  if (entry?.kind !== 'run' && entry?.kind !== 'agent' && entry?.kind !== 'event') {
    throw new Error(`no done source ${id}`);
  }
  return entry;
};
