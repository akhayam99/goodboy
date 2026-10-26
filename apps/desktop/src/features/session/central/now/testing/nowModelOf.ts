import {
  brandId,
  type Agent,
  type IsoDateTime,
  type AgentId,
  type MountId,
  type Step,
  type StepId,
  type TurnState,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { FIXTURE_NOW, FIXTURE_SESSION } from '../../../../auto/testing/autoViewFixtures';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import { withoutAutoChildren } from '../../../../auto/withoutAutoChildren';
import type { AttachedRun } from '../../../../workflows/activeWorkflowRuns';
import type { WorkflowAdvanceState } from '../../../../workflows/advanceGate';
import { buildTimelineGroups } from '../../../timeline/buildTimelineGroups';
import type { SessionWorkModel } from '../../useSessionWorkModel';

export const NOW_SESSION = FIXTURE_SESSION;
export const NOW_CLOCK = FIXTURE_NOW;
export const NOW_MOUNT_API = brandId<MountId>({ value: 'mount-payments-api' });
export const NOW_MOUNT_LEDGER = brandId<MountId>({ value: 'mount-ledger-core' });

export const NOW_STARTED_AT = brandId<IsoDateTime>({ value: '2026-10-13T11:52:00.000Z' });

type WorkflowParams = {
  readonly key: string;
  readonly name: string;
  readonly stepNames: ReadonlyArray<string>;
  readonly origin?: Workflow['origin'];
};

export const aNowWorkflow = ({
  key,
  name,
  stepNames,
  origin = 'custom',
}: WorkflowParams): Workflow => {
  const workflowId = brandId<WorkflowId>({ value: `workflow-${key}` });
  const steps: ReadonlyArray<Step> = stepNames.map((stepName, index) => ({
    id: brandId<StepId>({ value: `step-${key}-${index}` }),
    workflowId,
    ordinal: index,
    name: stepName,
    promptPrefix: '',
  }));
  return {
    id: workflowId,
    workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
    name,
    description: '',
    steps,
    origin,
    createdAt: NOW_STARTED_AT,
    updatedAt: NOW_STARTED_AT,
  };
};

type RunParams = {
  readonly key: string;
  readonly workflow: Workflow;
  readonly title?: string;
  readonly isDynamic?: boolean;
  readonly overrides?: Partial<WorkflowRun>;
};

export const aNowRun = ({
  key,
  workflow,
  title,
  isDynamic = false,
  overrides = {},
}: RunParams): AttachedRun => ({
  workflow,
  run: {
    id: brandId<WorkflowRunId>({ value: `run-${key}` }),
    workflowId: workflow.id,
    ordinal: 1,
    currentStep: 0,
    autoRun: false,
    triggerMode: 'immediate',
    executionMode: isDynamic ? 'dynamic' : 'static',
    title,
    createdAt: NOW_STARTED_AT,
    ...overrides,
  },
});

type StepAgentParams = {
  readonly attached: AttachedRun;
  readonly stepIndex: number;
  readonly status: Agent['status'];
  readonly name: string;
  readonly mountId?: MountId;
  readonly parentAgentId?: AgentId;
  readonly key?: string;
  readonly kind?: string;
};

export const aNowStepAgent = ({
  attached,
  stepIndex,
  status,
  name,
  mountId,
  parentAgentId,
  key = `${attached.run.id}-${stepIndex}`,
  kind,
}: StepAgentParams): Agent =>
  anAgent({
    kind,
    id: brandId<AgentId>({ value: `agent-${key}` }),
    sessionId: NOW_SESSION,
    stepId: attached.workflow.steps[stepIndex]?.id,
    workflowRunId: attached.run.id,
    parentAgentId,
    ordinal: stepIndex,
    name,
    status,
    startedAt: status === 'pending' ? undefined : NOW_STARTED_AT,
    mountId,
  });

type StandaloneParams = {
  readonly key: string;
  readonly name: string;
  readonly status: Agent['status'];
  readonly kind?: string;
  readonly mountId?: MountId;
  readonly stoppedBy?: Agent['stoppedBy'];
};

export const aNowAgent = ({
  key,
  name,
  status,
  kind,
  mountId,
  stoppedBy,
}: StandaloneParams): Agent =>
  anAgent({
    id: brandId<AgentId>({ value: `agent-${key}` }),
    sessionId: NOW_SESSION,
    name,
    status,
    kind,
    mountId,
    stoppedBy,
    startedAt: status === 'pending' ? undefined : NOW_STARTED_AT,
  });

type ModelParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly runs?: ReadonlyArray<AttachedRun>;
  readonly autoTrees?: ReadonlyArray<AutoTreeView>;
  readonly decidingRunIds?: ReadonlySet<string>;
  readonly advanceByRunId?: ReadonlyMap<string, WorkflowAdvanceState>;
  readonly turnByAgentId?: ReadonlyMap<string, TurnState>;
};

export const nowModelOf = ({
  agents,
  runs = [],
  autoTrees = [],
  decidingRunIds = new Set(),
  advanceByRunId = new Map(),
  turnByAgentId = new Map(),
}: ModelParams): SessionWorkModel => ({
  entries: buildTimelineGroups({
    sessionId: NOW_SESSION,
    agents: withoutAutoChildren({ agents, views: autoTrees }),
    workflows: runs,
    plans: [],
    artifacts: [],
    externalTasks: [],
    questions: [],
    worktrees: [],
    events: [],
    agentKindOverride: {},
  }).entries,
  events: [],
  autoTrees,
  workflows: runs,
  advanceByRunId,
  decidingRunIds,
  unreadAgentIds: new Set(),
  liveAgentIds: undefined,
  owners: [],
  resolveFactsByAgentId: new Map(),
  jobFactsByAgentId: new Map(),
  autoFactsByAgentId: new Map(),
  turnByAgentId,
  isLoaded: true,
});
