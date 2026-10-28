import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type MeasuredTurnSpan,
  type ProviderRunId,
  type SessionEvent,
  type SessionEventId,
  type Step,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { sceneClock } from '../../../sceneClock';
import { SESSION, SESSION_ID } from '../../activityRunSeed';
import { seedCentralColumn } from '../../u26/centralColumnSeed';

const clock = sceneClock({ anchor: '2026-10-18T10:31:00.000Z' });

type AtParams = {
  readonly time: string;
};

const at = ({ time }: AtParams): IsoDateTime => clock.iso({ at: `2026-10-18T${time}:00.000Z` });

type KeyParams = {
  readonly key: string;
};

const agentIdOf = ({ key }: KeyParams): AgentId =>
  brandId<AgentId>({ value: `mock-running-list-agent-${key}` });

const COPY_WORKFLOW_ID = brandId<WorkflowId>({ value: 'mock-running-list-workflow-copy' });
const COPY_RUN_ID = brandId<WorkflowRunId>({ value: 'mock-running-list-run-copy' });
const BUILD_WORKFLOW_ID = brandId<WorkflowId>({ value: 'mock-running-list-workflow-build' });
const BUILD_RUN_ID = brandId<WorkflowRunId>({ value: 'mock-running-list-run-build' });

type StepIdParams = {
  readonly prefix: string;
  readonly index: number;
};

const stepIdOf = ({ prefix, index }: StepIdParams): StepId =>
  brandId<StepId>({ value: `mock-running-list-${prefix}-step-${index}` });

type WorkflowParams = {
  readonly id: WorkflowId;
  readonly prefix: string;
  readonly name: string;
  readonly stepNames: ReadonlyArray<string>;
};

const workflowOf = ({ id, prefix, name, stepNames }: WorkflowParams): Workflow => ({
  id,
  workspaceId: SESSION.workspaceId,
  name,
  description: '',
  origin: 'library',
  steps: stepNames.map((stepName, index): Step => ({
    id: stepIdOf({ prefix, index }),
    workflowId: id,
    ordinal: index,
    name: stepName,
    promptPrefix: '',
  })),
  createdAt: at({ time: '09:00' }),
  updatedAt: at({ time: '09:00' }),
});

type RunParams = {
  readonly id: WorkflowRunId;
  readonly workflowId: WorkflowId;
  readonly title: string;
  readonly currentStep: number;
};

const runOf = ({ id, workflowId, title, currentStep }: RunParams): WorkflowRun => ({
  id,
  workflowId,
  ordinal: 0,
  currentStep,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  title,
  createdAt: at({ time: '09:45' }),
});

type AgentParams = {
  readonly key: string;
  readonly name: string;
  readonly kind: string;
  readonly status: Agent['status'];
  readonly ordinal: number;
  readonly startedAt: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly stepId?: StepId;
  readonly workflowRunId?: WorkflowRunId;
  readonly parentAgentId?: AgentId;
};

const agentOf = ({
  key,
  name,
  kind,
  status,
  ordinal,
  startedAt,
  completedAt,
  stepId,
  workflowRunId,
  parentAgentId,
}: AgentParams): Agent => ({
  id: agentIdOf({ key }),
  sessionId: SESSION_ID,
  ordinal,
  name,
  kind,
  status,
  runId: brandId<ProviderRunId>({ value: `mock-running-list-provider-run-${key}` }),
  startedAt,
  ...(completedAt === undefined ? {} : { completedAt }),
  ...(stepId === undefined ? {} : { stepId }),
  ...(workflowRunId === undefined ? {} : { workflowRunId }),
  ...(parentAgentId === undefined ? {} : { parentAgentId }),
});

type SpanParams = {
  readonly agent: Agent;
};

const spanOf = ({ agent }: SpanParams): MeasuredTurnSpan => ({
  agentId: agent.id,
  parentAgentId: agent.parentAgentId ?? null,
  agentStatus: agent.status,
  workflowRunId: agent.workflowRunId ?? null,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  startedAtMs: Date.parse(agent.startedAt ?? at({ time: '10:00' })),
  endedAtMs: Date.parse(agent.completedAt ?? at({ time: '10:31' })),
  endReason: 'succeeded',
  costUsd: null,
  touchedMountIds: null,
});

const COPY = workflowOf({
  id: COPY_WORKFLOW_ID,
  prefix: 'copy',
  name: 'Fix the copy',
  stepNames: ['Find the wording', 'Rewrite the strings'],
});

const BUILD = workflowOf({
  id: BUILD_WORKFLOW_ID,
  prefix: 'build',
  name: 'Build',
  stepNames: ['Scope', 'Tests first', 'Implement', 'Review', 'Update docs', 'Push'],
});

const BUILD_STEP_AGENT = agentIdOf({ key: 'build-3' });

const AGENTS: ReadonlyArray<Agent> = [
  agentOf({
    key: 'rewriter',
    name: 'History rewriter',
    kind: 'rewriter',
    status: 'running',
    ordinal: 1,
    startedAt: at({ time: '10:30' }),
  }),
  agentOf({
    key: 'copy-1',
    name: 'Find the wording',
    kind: 'scout',
    status: 'completed',
    ordinal: 2,
    startedAt: at({ time: '10:05' }),
    completedAt: at({ time: '10:09' }),
    stepId: stepIdOf({ prefix: 'copy', index: 0 }),
    workflowRunId: COPY_RUN_ID,
  }),
  agentOf({
    key: 'build-1',
    name: 'Scope the change',
    kind: 'scout',
    status: 'completed',
    ordinal: 3,
    startedAt: at({ time: '09:50' }),
    completedAt: at({ time: '09:55' }),
    stepId: stepIdOf({ prefix: 'build', index: 0 }),
    workflowRunId: BUILD_RUN_ID,
  }),
  agentOf({
    key: 'build-2',
    name: 'Write the tests first',
    kind: 'tester',
    status: 'completed',
    ordinal: 4,
    startedAt: at({ time: '10:10' }),
    completedAt: at({ time: '10:19' }),
    stepId: stepIdOf({ prefix: 'build', index: 1 }),
    workflowRunId: BUILD_RUN_ID,
  }),
  agentOf({
    key: 'build-3',
    name: 'Add the limit check to payout creation',
    kind: 'implementer',
    status: 'running',
    ordinal: 5,
    startedAt: at({ time: '10:28' }),
    stepId: stepIdOf({ prefix: 'build', index: 2 }),
    workflowRunId: BUILD_RUN_ID,
  }),
  agentOf({
    key: 'build-child',
    name: 'Check the retry path',
    kind: 'tester',
    status: 'running',
    ordinal: 6,
    startedAt: at({ time: '10:29' }),
    parentAgentId: BUILD_STEP_AGENT,
  }),
  agentOf({
    key: 'ci-1',
    name: 'CI fix · static-analysis · #9995',
    kind: 'ci-debugger',
    status: 'running',
    ordinal: 7,
    startedAt: at({ time: '10:29' }),
  }),
  agentOf({
    key: 'ci-2',
    name: 'CI fix · static-analysis · #10003',
    kind: 'ci-debugger',
    status: 'running',
    ordinal: 8,
    startedAt: at({ time: '10:30' }),
  }),
  agentOf({
    key: 'import',
    name: 'Retry the ledger-core import',
    kind: 'implementer',
    status: 'failed',
    ordinal: 9,
    startedAt: at({ time: '10:12' }),
    completedAt: at({ time: '10:14' }),
  }),
];

const RUNNING_KEYS: ReadonlyArray<string> = ['rewriter', 'build-3', 'build-child', 'ci-1', 'ci-2'];

export const seedRunningList = (): void => {
  seedCentralColumn({ kind: 'mid' });
  const mountId = useAppStore.getState().sessionProjectMounts[SESSION_ID]?.[0]?.mountId;
  const stopped: SessionEvent = {
    id: brandId<SessionEventId>({ value: 'mock-running-list-event-stopped' }),
    sessionId: SESSION_ID,
    kind: 'history_stopped',
    payload: {
      agentId: agentIdOf({ key: 'rewriter' }),
      origin: 'rebase',
      branch: 'ak/eng-1190-tenant-limits',
      mountId,
      reason: 'origin-moved',
    },
    createdAt: at({ time: '10:30' }),
  };
  const runs = [
    runOf({ id: COPY_RUN_ID, workflowId: COPY_WORKFLOW_ID, title: 'Fix the copy', currentStep: 1 }),
    runOf({ id: BUILD_RUN_ID, workflowId: BUILD_WORKFLOW_ID, title: 'Build', currentStep: 2 }),
  ];
  useAppStore.setState((state) => ({
    sessions: state.sessions.map((session) =>
      session.id === SESSION_ID ? { ...session, workflowRuns: runs } : session,
    ),
    sessionPhaseRuns: { [SESSION_ID]: AGENTS },
    sessionWorkflows: { [SESSION_ID]: [COPY, BUILD] },
    phaseTemplates: { [SESSION.workspaceId]: [COPY, BUILD] },
    sessionEvents: { [SESSION_ID]: [stopped] },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    autoTreeViews: { [SESSION_ID]: [] },
    orchestratingWorkflowRuns: {},
    sessionGithub: {},
    mountGithub: {},
    sessionTurnSpans: { [SESSION_ID]: AGENTS.map((agent) => spanOf({ agent })) },
    agentTurnState: Object.fromEntries(
      RUNNING_KEYS.map((key) => [
        agentIdOf({ key }),
        {
          kind: 'running',
          runId: brandId<ProviderRunId>({ value: 'mock-running-list-provider-run-live' }),
          startedAt: at({ time: '10:29' }),
        },
      ]),
    ),
  }));
};
