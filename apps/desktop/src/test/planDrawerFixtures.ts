import type {
  AgentId,
  ArtifactComment,
  OpenQuestion,
  OpenQuestionId,
  PlanArtifact,
  PlanWithCount,
  StepId,
  TurnState,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import { aSession, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../store';
import {
  PLAN_FIXTURE_AT,
  PLAN_FIXTURE_ID,
  PLAN_FIXTURE_PLANNER,
  PLAN_FIXTURE_SESSION,
  aPlan,
  aStoredPlan,
} from './planFixtures';

const REAL = useAppStore.getState();

const REAL_ACTIONS = {
  navigate: REAL.navigate,
  approveWorkflowRunPlan: REAL.approveWorkflowRunPlan,
  runPlan: REAL.runPlan,
  reportError: REAL.reportError,
  updatePlanBody: REAL.updatePlanBody,
  sendArtifactComments: REAL.sendArtifactComments,
};

export const PLAN_RUN_ID = 'run-harborline' as WorkflowRunId;

export const PLAN_WORKFLOW_ID = 'workflow-harborline' as WorkflowId;

export const PLAN_WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;

export const PLAN_IMPLEMENTER = 'agent-implementer' as AgentId;

const PLAN_STEP_PLAN = 'step-0' as StepId;

const PLAN_STEP_IMPLEMENT = 'step-1' as StepId;

export const aPlannerQuestion = (overrides: Partial<OpenQuestion> = {}): OpenQuestion => ({
  id: 'question-1' as OpenQuestionId,
  sessionId: PLAN_FIXTURE_SESSION,
  createdByAgentId: PLAN_FIXTURE_PLANNER,
  text: 'Should refunds older than 90 days stay in the export?',
  suggestedAnswers: ['Keep them', 'Drop them'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: PLAN_FIXTURE_AT,
  ...overrides,
});

export const aPlanDraft = (overrides: Partial<ArtifactComment> = {}): ArtifactComment => ({
  id: 'comment-1',
  sessionId: PLAN_FIXTURE_SESSION,
  artifactId: PLAN_FIXTURE_ID,
  revision: 2,
  anchor: {
    kind: 'block',
    order: 0,
    text: 'Retried webhooks must never post a second credit.',
  },
  body: 'Say which webhooks retry',
  status: 'draft',
  sentTurnId: null,
  createdAt: PLAN_FIXTURE_AT,
  updatedAt: PLAN_FIXTURE_AT,
  ...overrides,
});

export const aPlanWorkflow = (): Workflow => ({
  id: PLAN_WORKFLOW_ID,
  workspaceId: PLAN_WORKSPACE_ID,
  name: 'Retry payments through ledger-core',
  description: '',
  steps: [
    {
      id: PLAN_STEP_PLAN,
      workflowId: PLAN_WORKFLOW_ID,
      ordinal: 0,
      name: 'Plan',
      role: 'planner',
      promptPrefix: '',
    },
    {
      id: PLAN_STEP_IMPLEMENT,
      workflowId: PLAN_WORKFLOW_ID,
      ordinal: 1,
      name: 'Implement',
      role: 'implementer',
      promptPrefix: '',
    },
  ],
  createdAt: PLAN_FIXTURE_AT,
  updatedAt: PLAN_FIXTURE_AT,
});

export type PlanRunKind = 'none' | 'held' | 'feeding' | 'took' | 'orchestrated';

export type PlanDrawerSeed = Readonly<{
  revision?: number;
  status?: PlanWithCount['status'];
  turn?: TurnState;
  run?: PlanRunKind;
  isAutoRun?: boolean;
  drafts?: ReadonlyArray<ArtifactComment>;
  questions?: ReadonlyArray<OpenQuestion>;
  parts?: number;
  runId?: WorkflowRunId;
}>;

const runOf = ({
  kind,
  isAutoRun,
  runId,
}: {
  readonly kind: PlanRunKind;
  readonly isAutoRun: boolean;
  readonly runId: WorkflowRunId;
}) =>
  aWorkflowRun({
    id: runId,
    workflowId: PLAN_WORKFLOW_ID,
    autoRun: isAutoRun,
    ...(kind === 'held'
      ? { orchestrationStop: { kind: 'plan-approval' as const, message: 'The plan is ready.' } }
      : {}),
    ...(kind === 'took'
      ? { rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, planApproved: true } }
      : {}),
    ...(kind === 'orchestrated'
      ? {
          executionMode: 'dynamic' as const,
          rulesSnapshot: {
            ...DEFAULT_WORKFLOW_RULES,
            autonomy: 'plan' as const,
            planApproved: true,
          },
        }
      : {}),
  });

const partsOf = ({ count }: { readonly count: number }): PlanWithCount['clusters'] =>
  count === 0
    ? undefined
    : Array.from({ length: count }, (_, index) => ({
        title: `Part ${index + 1}`,
        instructions: 'Write it.',
      }));

export const seedPlanDrawer = ({
  revision = 2,
  status = 'active',
  turn = { kind: 'idle', lastActivityAt: PLAN_FIXTURE_AT },
  run = 'none',
  isAutoRun = false,
  drafts = [],
  questions = [],
  parts = 0,
  runId = PLAN_RUN_ID,
}: PlanDrawerSeed = {}): { readonly plan: PlanWithCount; readonly stored: PlanArtifact } => {
  const clusters = partsOf({ count: parts });
  const plan = aPlan({
    status,
    consumptionCount: status === 'consumed' ? 1 : 0,
    ...(clusters === undefined ? {} : { clusters }),
    ...(run === 'none' ? {} : { workflowRunId: runId }),
  });
  const stored = aStoredPlan({ revision, status }, plan);
  const isRunPlan = run !== 'none';
  const planner = anAgent({
    id: PLAN_FIXTURE_PLANNER,
    sessionId: PLAN_FIXTURE_SESSION,
    name: 'Planner',
    ordinal: 0,
    status: 'completed',
    ...(isRunPlan ? { workflowRunId: runId, stepId: PLAN_STEP_PLAN } : {}),
  });
  const implementer = anAgent({
    id: PLAN_IMPLEMENTER,
    sessionId: PLAN_FIXTURE_SESSION,
    name: 'Implement',
    ordinal: 1,
    status: 'pending',
    workflowRunId: runId,
    stepId: PLAN_STEP_IMPLEMENT,
  });
  const workflowRuns: ReadonlyArray<WorkflowRun> = isRunPlan
    ? [runOf({ kind: run, isAutoRun, runId })]
    : [];
  useAppStore.setState({
    ...REAL_ACTIONS,
    activeLens: {},
    focusedWorkflowRunId: {},
    sessions: [
      aSession({
        id: PLAN_FIXTURE_SESSION,
        workspaceId: PLAN_WORKSPACE_ID,
        workflowRuns: [...workflowRuns],
      }),
    ],
    currentSessionId: PLAN_FIXTURE_SESSION,
    phaseTemplates: { [PLAN_WORKSPACE_ID]: [aPlanWorkflow()] },
    sessionPlans: { [PLAN_FIXTURE_SESSION]: [plan] },
    sessionArtifacts: { [PLAN_FIXTURE_SESSION]: [stored] },
    sessionPhaseRuns: {
      [PLAN_FIXTURE_SESSION]:
        isRunPlan && run !== 'orchestrated' ? [planner, implementer] : [planner],
    },
    sessionOpenQuestions: { [PLAN_FIXTURE_SESSION]: [...questions] },
    agentTurnState: { [PLAN_FIXTURE_PLANNER]: turn },
    artifactComments: { [PLAN_FIXTURE_SESSION]: [...drafts] },
    artifactCommentSends: {},
    documentDrawerExpanded: {},
    drawer: null,
    loadArtifactComments: async () => undefined,
  });
  return { plan, stored };
};
