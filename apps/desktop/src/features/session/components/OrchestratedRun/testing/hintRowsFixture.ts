import {
  DEFAULT_WORKFLOW_RULES,
  brandId,
  type Agent,
  type GoalAttachment,
  type IsoDateTime,
  type OrchestratorHint,
  type Session,
  type Step,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
} from '@goodboy/types';
import { aSession, aWorkflowRun, aWorkspace, anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../../../../store';

type SeedParams = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
  readonly agentCount: number;
  readonly isLoaded?: boolean;
  readonly readingIds?: ReadonlyArray<string>;
};

type RunParams = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
};

type AgentsParams = {
  readonly count: number;
};

type Seeded = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
};

const AT: IsoDateTime = JSON.parse('"2026-10-30T10:00:00.000Z"');
const WORKING_DIR = '/worktrees/payments-api';
const WORKFLOW_ID = brandId<WorkflowId>({ value: 'hint-rows-workflow' });
const STEP_NAMES = ['Find the retry loop', 'Cap the webhook retries', 'Prove the retries stop'];

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });

const stepIdOf = ({ index }: { readonly index: number }): StepId =>
  brandId<StepId>({ value: `hint-rows-step-${index}` });

const STEPS: ReadonlyArray<Step> = STEP_NAMES.map((name, index) => ({
  id: stepIdOf({ index }),
  workflowId: WORKFLOW_ID,
  ordinal: index,
  name,
  role: 'scout',
  promptPrefix: '',
  orchestratorReason: '',
}));

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: workspace.id,
  name: 'Stop the checkout retry storm',
  description: '',
  origin: 'orchestrated',
  processText: '',
  steps: STEPS,
  createdAt: AT,
  updatedAt: AT,
};

const session = aSession({ workspaceId: workspace.id, goal: 'Checkout retry storm' });

const runIdOfFixture = aWorkflowRun().id;

const run = ({ hints }: RunParams): WorkflowRun =>
  aWorkflowRun({
    id: runIdOfFixture,
    workflowId: WORKFLOW_ID,
    currentStep: 1,
    autoRun: true,
    executionMode: 'dynamic',
    title: 'Stop the checkout retry storm',
    goal: 'Checkout retries hammer payments-api after a webhook timeout.',
    rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' },
    orchestratorHints: hints,
  });

const agentsOf = ({ count }: AgentsParams): ReadonlyArray<Agent> =>
  STEPS.slice(0, count).map((step, index) =>
    anAgent({
      sessionId: session.id,
      workflowRunId: runIdOfFixture,
      stepId: step.id,
      ordinal: index,
      name: step.name,
      kind: 'scout',
      status: index === count - 1 ? 'running' : 'completed',
      startedAt: AT,
    }),
  );

const imageRows = (): ReadonlyArray<GoalAttachment> =>
  ['checkout-502', 'relay-log'].map((name) => ({
    id: `hint-rows-${name}`,
    ownerType: 'workflow_run',
    ownerId: runIdOfFixture,
    relPath: `.goodboy/attachments/${name}.png`,
    kind: 'image',
    fileName: `${name}.png`,
    mimeType: 'image/png',
    createdAt: AT,
  }));

const seed = ({ hints, agentCount, isLoaded = false, readingIds = [] }: SeedParams): Seeded => {
  const seededRun = run({ hints });
  const agents = agentsOf({ count: agentCount });
  const seededSession = { ...session, workflowRuns: [seededRun] };
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    sessions: [seededSession],
    currentSessionId: seededSession.id,
    sessionWorkflows: { [seededSession.id]: [workflow] },
    sessionPhaseRuns: { [seededSession.id]: agents },
    sessionTelemetry: { [seededSession.id]: [] },
    sessionWorktrees: { [seededSession.id]: [WORKING_DIR] },
    workflowRunAttachments: isLoaded ? { [seededRun.id]: imageRows() } : {},
    orchestratingWorkflowRuns: { [seededRun.id]: false },
    orchestratorReadingHints: { [seededRun.id]: [...readingIds] },
    transcripts: {},
    messages: { [seededSession.id]: [] },
    loadAgentTranscript: async () => undefined,
    loadSessionTelemetry: async () => undefined,
    sessionPlans: { [seededSession.id]: [] },
    sessionOpenQuestions: { [seededSession.id]: [] },
    sessionAnsweredQuestions: { [seededSession.id]: [] },
    drawer: null,
  });
  return { session: seededSession, run: seededRun, workflow, agents };
};

export const hintRowsFixture = {
  seed,
  runWith: run,
  agentsOf,
  imageRows,
  imageIds: imageRows().map((row) => row.id),
  stepIdOf,
  workingDir: WORKING_DIR,
};
