import { MODEL_CATALOGS } from '@goodboy/core';
import {
  brandId,
  type Agent,
  type AgentId,
  type AgentRole,
  type ProviderRunId,
  type Step,
  type StepId,
  type Workflow,
} from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import type { AgentKind } from '../../../../../features/session/agent-kind';
import { useAppStore } from '../../../../../store';
import { AUTO_STORY, GUARD_BRANCH, ORCHESTRATE_GOAL } from '../../demo/director/autoStory';
import {
  DYNAMIC_RUN_ID,
  DYNAMIC_WORKFLOW,
  FLOW_MOUNTS,
  FLOW_SESSION_ID,
  NOW,
  SESSIONS,
} from '../flow-audit/fixtures';
import { seedWorkflowRun } from '../flow-audit/seeds';
import { agoIso } from './agoIso';
import { DEMO_RUN_SESSION } from './demoRunSession';

type ModelParams = {
  readonly label: string;
};

const modelKeyOf = ({ label }: ModelParams): string =>
  MODEL_CATALOGS.anthropic.find((model) => model.label === label)?.key ?? label;

type StepSpec = {
  readonly key: string;
  readonly kind: AgentRole & AgentKind;
  readonly name: string;
  readonly task: string;
  readonly why: string;
  readonly summary: string;
  readonly model: string;
  readonly startedMinutes: number;
  readonly doneMinutes: number;
};

const STEP_SPECS: ReadonlyArray<StepSpec> = [
  {
    key: 'plan',
    kind: 'planner',
    name: 'Plan one event id guard for every webhook consumer',
    task: AUTO_STORY.plannerTask,
    why: 'The goal crosses payments-api and ledger-core, so a plan is written and agreed before any code moves.',
    summary: 'One guard keyed on the event id sits in front of every consumer.',
    model: modelKeyOf({ label: 'Opus 5.5' }),
    startedMinutes: 58,
    doneMinutes: 49,
  },
  {
    key: 'payments',
    kind: 'implementer',
    name: 'Add one event id guard in front of every webhook consumer in payments-api',
    task: AUTO_STORY.implementerTask,
    why: 'The plan names one guard for every consumer, so a single implementer keeps them consistent.',
    summary: AUTO_STORY.implementerSummary,
    model: modelKeyOf({ label: 'Sonnet 5.5' }),
    startedMinutes: 47,
    doneMinutes: 24,
  },
  {
    key: 'tests',
    kind: 'tester',
    name: 'Replay each event three times on a second payments-api branch',
    task: AUTO_STORY.testerTask,
    why: 'The Sentry trace shows three deliveries of one event, so the run does not close until a test replays each event three times.',
    summary: AUTO_STORY.testerSummary,
    model: modelKeyOf({ label: 'Sonnet 5.5' }),
    startedMinutes: 46,
    doneMinutes: 20,
  },
  {
    key: 'ledger',
    kind: 'implementer',
    name: 'Guard the ledger-core consumer on the event id',
    task: AUTO_STORY.ledgerTask,
    why: 'ledger-core runs its own consumer, and that change is independent of the payments-api guard.',
    summary: AUTO_STORY.ledgerSummary,
    model: modelKeyOf({ label: 'Sonnet 5.5' }),
    startedMinutes: 45,
    doneMinutes: 18,
  },
];

type KeyParams = {
  readonly key: string;
};

const stepIdOf = ({ key }: KeyParams): StepId => brandId<StepId>({ value: `demo-run-step-${key}` });

const agentIdOf = ({ key }: KeyParams): AgentId =>
  brandId<AgentId>({ value: `demo-run-agent-${key}` });

type SpecParams = {
  readonly spec: StepSpec;
  readonly index: number;
};

const stepOf = ({ spec, index }: SpecParams): Step => ({
  id: stepIdOf({ key: spec.key }),
  workflowId: DYNAMIC_WORKFLOW.id,
  role: spec.kind,
  ordinal: index,
  name: spec.name,
  promptPrefix: spec.task,
  orchestratorReason: spec.why,
});

const agentOf = ({ spec, index }: SpecParams): Agent => {
  const completedAt = agoIso({ minutes: spec.doneMinutes });
  return {
    id: agentIdOf({ key: spec.key }),
    sessionId: FLOW_SESSION_ID,
    stepId: stepIdOf({ key: spec.key }),
    workflowRunId: DYNAMIC_RUN_ID,
    ordinal: index,
    name: spec.name,
    kind: spec.kind,
    status: 'completed',
    runId: brandId<ProviderRunId>({ value: `demo-run-provider-${spec.key}` }),
    outputSummary: spec.summary,
    startedAt: agoIso({ minutes: spec.startedMinutes }),
    completedAt,
    lastFinishedAt: completedAt,
    lastViewedAt: NOW,
    doneAt: completedAt,
  };
};

const DEMO_WORKFLOW: Workflow = {
  ...DYNAMIC_WORKFLOW,
  goal: ORCHESTRATE_GOAL,
  name: 'Idempotent webhook consumers',
  description:
    'Plan one event id guard, put it in front of every webhook consumer in payments-api, replay each event three times and guard the ledger-core consumer the same way.',
  processText: AUTO_STORY.second,
  steps: STEP_SPECS.map((spec, index) => stepOf({ spec, index })),
};

const PROVIDER: ProviderDisplayInfo['id'] = 'anthropic';

export const seedDemoRun = (): void => {
  seedWorkflowRun();
  useAppStore.setState((state) => ({
    sessionProjectMounts: {
      ...state.sessionProjectMounts,
      [FLOW_SESSION_ID]: FLOW_MOUNTS.map((mount) => ({ ...mount, branch: GUARD_BRANCH })),
    },
    sessionBranches: { ...state.sessionBranches, [FLOW_SESSION_ID]: GUARD_BRANCH },
    sessionWorktreeRecords: {
      ...(state.sessionWorktreeRecords ?? {}),
      [FLOW_SESSION_ID]: (state.sessionWorktreeRecords?.[FLOW_SESSION_ID] ?? []).map((record) => ({
        ...record,
        branch: GUARD_BRANCH,
      })),
    },
  }));
  const agents = STEP_SPECS.map((spec, index) => agentOf({ spec, index }));
  useAppStore.setState({
    sessions: SESSIONS.map((session) =>
      session.id === FLOW_SESSION_ID ? DEMO_RUN_SESSION : session,
    ),
    sessionWorkflows: { [FLOW_SESSION_ID]: [DEMO_WORKFLOW] },
    sessionPhaseRuns: { [FLOW_SESSION_ID]: agents },
    sessionTelemetry: { [FLOW_SESSION_ID]: [] },
    sessionTurnSpans: { [FLOW_SESSION_ID]: [] },
    agentKindOverride: Object.fromEntries(
      STEP_SPECS.map((spec) => [agentIdOf({ key: spec.key }), spec.kind]),
    ),
    agentModelOverride: Object.fromEntries(
      STEP_SPECS.map((spec) => [agentIdOf({ key: spec.key }), spec.model]),
    ),
    agentProviderOverride: Object.fromEntries(
      STEP_SPECS.map((spec) => [agentIdOf({ key: spec.key }), PROVIDER]),
    ),
    agentTurnState: {},
    selectedAgentId: { [FLOW_SESSION_ID]: agentIdOf({ key: STEP_SPECS[0]?.key ?? 'plan' }) },
    workflowRunAttachments: { [DYNAMIC_RUN_ID]: [] },
    loadPhaseTemplates: async () => undefined,
    loadStepLibrary: async () => undefined,
    setWorkflowStudioVisible: () => undefined,
  });
};
