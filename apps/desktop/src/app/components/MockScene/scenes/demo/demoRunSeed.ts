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
import { AUTO_STORY } from '../../demo/director/autoStory';
import {
  DYNAMIC_RUN_ID,
  DYNAMIC_WORKFLOW,
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
    name: 'Plan the fix for the double credit on a retried webhook',
    task: AUTO_STORY.plannerTask,
    why: 'The goal crosses payments-api and ledger-core, so a plan is written and agreed before any code moves.',
    summary: 'Key the credit on the processor event id and check it inside the transaction.',
    model: modelKeyOf({ label: 'Opus 5.5' }),
    startedMinutes: 58,
    doneMinutes: 49,
  },
  {
    key: 'payments',
    kind: 'implementer',
    name: 'Check the event id inside the credit transaction in payments-api',
    task: AUTO_STORY.implementerTask,
    why: 'The plan is unambiguous and touches one handler, so one implementer is cheaper than splitting the edit.',
    summary: AUTO_STORY.implementerSummary,
    model: modelKeyOf({ label: 'Sonnet 5.5' }),
    startedMinutes: 47,
    doneMinutes: 24,
  },
  {
    key: 'tests',
    kind: 'tester',
    name: 'Replay one event three times on a second payments-api branch',
    task: AUTO_STORY.testerTask,
    why: 'The Sentry trace shows three deliveries of one event, so the run does not close until a test replays exactly that.',
    summary: AUTO_STORY.testerSummary,
    model: modelKeyOf({ label: 'Sonnet 5.5' }),
    startedMinutes: 46,
    doneMinutes: 20,
  },
  {
    key: 'ledger',
    kind: 'implementer',
    name: 'Keep one posting per event id in ledger-core',
    task: AUTO_STORY.ledgerTask,
    why: 'ledger-core must still show one posting per event id, and that change is independent of the handler.',
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
  name: 'Webhook credit fix',
  description:
    'Plan the fix, change the credit handler in payments-api, replay one event three times and keep one posting per event id in ledger-core.',
  processText: AUTO_STORY.second,
  steps: STEP_SPECS.map((spec, index) => stepOf({ spec, index })),
};

const PROVIDER: ProviderDisplayInfo['id'] = 'anthropic';

export const seedDemoRun = (): void => {
  seedWorkflowRun();
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
