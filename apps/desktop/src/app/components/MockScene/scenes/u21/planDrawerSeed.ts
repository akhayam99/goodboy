import type {
  Agent,
  AgentId,
  ArtifactComment,
  ArtifactId,
  OpenQuestion,
  OpenQuestionId,
  PlanArtifact,
  PlanWithCount,
  ProviderRunId,
  Session,
  SessionId,
  StepId,
  TurnState,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { installSceneDatabase } from '../sceneDatabase';
import { installScenePlanEngine } from '../scenePlanEngine';

export type PlanDrawerVariant =
  | 'waiting'
  | 'drafts'
  | 'revising'
  | 'unchanged'
  | 'question'
  | 'editing'
  | 'conflict'
  | 'split'
  | 'follow';

const clock = sceneClock({ anchor: '2026-10-06T09:40:00.000Z' });

const NOW = clock.iso({ at: '2026-10-06T09:40:00.000Z' });

const WORKSPACE_ID = 'mock-plan-drawer-workspace' as WorkspaceId;
export const PLAN_DRAWER_SESSION_ID = 'mock-plan-drawer-session' as SessionId;
const WORKFLOW_ID = 'mock-plan-drawer-workflow' as WorkflowId;
const PLAN_DRAWER_RUN_ID = 'mock-plan-drawer-run' as WorkflowRunId;
export const PLAN_DRAWER_PLAN_ID = 'mock-plan-drawer-plan' as ArtifactId;
const SCOUT_ID = 'mock-plan-drawer-agent-scout' as AgentId;
const PLANNER_ID = 'mock-plan-drawer-agent-planner' as AgentId;
const IMPLEMENTER_ID = 'mock-plan-drawer-agent-implementer' as AgentId;
const STEP_SCOUT = 'mock-plan-drawer-step-scout' as StepId;
const STEP_PLAN = 'mock-plan-drawer-step-plan' as StepId;
const STEP_IMPLEMENT = 'mock-plan-drawer-step-implement' as StepId;
const RUN_REVISING = 'mock-plan-drawer-provider-run-2' as ProviderRunId;
const QUESTION_ID = 'mock-plan-drawer-question' as OpenQuestionId;

const TITLE = 'Reconcile the settlement export';

const GOAL =
  'Every settlement batch in ledger-core must match its invoice, to the cent, before the export leaves Harborline.';

const BODY_STEPS = [
  `## Goal\n\n${GOAL}`,
  '## Steps',
  '1. Replace the CSV query with the ledger view',
  '2. Round half-even at the ledger boundary',
  '3. Replay last week of settlements and compare the totals',
].join('\n\n');

const BODY_SPLIT = [
  `## Goal\n\n${GOAL}`,
  '## Approach',
  'Read the batches from the ledger view, round once where an amount enters the ledger, then replay a week of settlements against their invoices.',
].join('\n\n');

const PARTS = [
  {
    title: 'Replace the CSV query with the ledger view',
    instructions: 'Read the batches from the ledger view, not the CSV.',
  },
  {
    title: 'Round half-even at the ledger boundary',
    instructions: 'Round once, where an amount enters the ledger.',
  },
  {
    title: 'Replay last week of settlements and compare the totals',
    instructions: 'Replay the week and compare each batch with its invoice.',
  },
];

const QUOTE = 'every settlement batch in ledger-core must match its invoice';

const draft = ({
  id,
  body,
  status,
}: {
  readonly id: string;
  readonly body: string;
  readonly status: ArtifactComment['status'];
}): ArtifactComment => ({
  id,
  sessionId: PLAN_DRAWER_SESSION_ID,
  artifactId: PLAN_DRAWER_PLAN_ID,
  revision: 2,
  anchor: { kind: 'quote', order: 0, text: QUOTE, blockText: GOAL },
  body,
  status,
  sentTurnId: null,
  createdAt: NOW,
  updatedAt: NOW,
});

const DRAFTS: ReadonlyArray<ArtifactComment> = [
  draft({
    id: 'mock-plan-drawer-comment-1',
    body: 'Say which view. The ledger has two.',
    status: 'draft',
  }),
  draft({
    id: 'mock-plan-drawer-comment-2',
    body: 'Finance rounds half up. Check with Priya Nair.',
    status: 'draft',
  }),
  draft({
    id: 'mock-plan-drawer-comment-3',
    body: 'Replay two weeks, not one.',
    status: 'draft',
  }),
];

const markSent = (comments: ReadonlyArray<ArtifactComment>): ReadonlyArray<ArtifactComment> =>
  comments.map((comment) => ({ ...comment, status: 'sent' as const }));

const QUESTION: OpenQuestion = {
  id: QUESTION_ID,
  sessionId: PLAN_DRAWER_SESSION_ID,
  createdByAgentId: PLANNER_ID,
  text: 'Should refunds older than 90 days stay in the export?',
  suggestedAnswers: ['Keep them', 'Drop them'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: NOW,
};

const SESSION: Session = {
  id: PLAN_DRAWER_SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Reconcile the settlement export in ledger-core',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: NOW,
  updatedAt: NOW,
};

const RUN: WorkflowRun = {
  id: PLAN_DRAWER_RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 1,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  orchestrationStop: {
    kind: 'plan-approval',
    message: 'The plan is ready. Approve it to start the rest of the run.',
  },
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' },
};

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Settlement export fix',
  description: '',
  steps: [
    {
      id: STEP_SCOUT,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Scout',
      role: 'scout',
      promptPrefix: '',
    },
    {
      id: STEP_PLAN,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Plan',
      role: 'planner',
      promptPrefix: '',
    },
    {
      id: STEP_IMPLEMENT,
      workflowId: WORKFLOW_ID,
      ordinal: 2,
      name: 'Implement',
      role: 'implementer',
      promptPrefix: '',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const agentsOf = ({ isPlannerBusy }: { readonly isPlannerBusy: boolean }): ReadonlyArray<Agent> => [
  {
    id: SCOUT_ID,
    sessionId: PLAN_DRAWER_SESSION_ID,
    ordinal: 0,
    name: 'Scout',
    kind: 'scout',
    status: 'completed',
    workflowRunId: PLAN_DRAWER_RUN_ID,
    stepId: STEP_SCOUT,
    startedAt: NOW,
    completedAt: NOW,
  },
  {
    id: PLANNER_ID,
    sessionId: PLAN_DRAWER_SESSION_ID,
    ordinal: 1,
    name: 'Planner',
    kind: 'planner',
    status: isPlannerBusy ? 'running' : 'completed',
    workflowRunId: PLAN_DRAWER_RUN_ID,
    stepId: STEP_PLAN,
    startedAt: NOW,
  },
  {
    id: IMPLEMENTER_ID,
    sessionId: PLAN_DRAWER_SESSION_ID,
    ordinal: 2,
    name: 'Implement',
    kind: 'implementer',
    status: 'pending',
    workflowRunId: PLAN_DRAWER_RUN_ID,
    stepId: STEP_IMPLEMENT,
  },
];

const turnOf = ({ variant }: { readonly variant: PlanDrawerVariant }): TurnState => {
  if (variant === 'revising') {
    return { kind: 'running', runId: RUN_REVISING, startedAt: NOW };
  }
  return { kind: 'idle', lastActivityAt: NOW };
};

const commentsOf = ({ variant }: { readonly variant: PlanDrawerVariant }) => {
  if (variant === 'drafts' || variant === 'unchanged' || variant === 'question') {
    return DRAFTS;
  }
  return variant === 'revising' ? markSent(DRAFTS) : [];
};

const planOf = ({ variant }: { readonly variant: PlanDrawerVariant }): PlanWithCount => ({
  id: PLAN_DRAWER_PLAN_ID,
  sessionId: PLAN_DRAWER_SESSION_ID,
  agentId: PLANNER_ID,
  workflowRunId: PLAN_DRAWER_RUN_ID,
  title: TITLE,
  bodyMd: variant === 'split' ? BODY_SPLIT : BODY_STEPS,
  status: 'active',
  ...(variant === 'split' ? { clusters: PARTS } : {}),
  createdAt: NOW,
  updatedAt: NOW,
  consumptionCount: 0,
});

const storedOf = ({ plan }: { readonly plan: PlanWithCount }): PlanArtifact => ({
  id: plan.id,
  sessionId: plan.sessionId,
  agentId: plan.agentId,
  workflowRunId: PLAN_DRAWER_RUN_ID,
  kind: 'plan',
  schemaVersion: 1,
  title: plan.title,
  sourceFormat: 'markdown',
  sourceText: plan.bodyMd,
  metadata: plan.clusters === undefined ? {} : { clusters: plan.clusters },
  status: 'active',
  revision: 2,
  sourceTurnId: 'mock-plan-drawer-provider-run-1',
  createdAt: NOW,
  updatedAt: NOW,
  openedAt: null,
});

export const seedPlanDrawerScene = ({ variant }: { readonly variant: PlanDrawerVariant }): void => {
  const plan = planOf({ variant });
  useAppStore.setState({
    sessions: [{ ...SESSION, workflowRuns: [RUN] }],
    currentSessionId: PLAN_DRAWER_SESSION_ID,
    phaseTemplates: { [WORKSPACE_ID]: [WORKFLOW] },
    sessionPhaseRuns: {
      [PLAN_DRAWER_SESSION_ID]: agentsOf({ isPlannerBusy: variant === 'revising' }),
    },
    sessionPlans: { [PLAN_DRAWER_SESSION_ID]: [plan] },
    sessionArtifacts: { [PLAN_DRAWER_SESSION_ID]: [storedOf({ plan })] },
    sessionOpenQuestions: { [PLAN_DRAWER_SESSION_ID]: variant === 'question' ? [QUESTION] : [] },
    sessionAnsweredQuestions: { [PLAN_DRAWER_SESSION_ID]: [] },
    agentTurnState: { [PLANNER_ID]: turnOf({ variant }) },
    artifactComments: { [PLAN_DRAWER_SESSION_ID]: commentsOf({ variant }) },
    artifactCommentSends: {},
    activeLens: { [PLAN_DRAWER_SESSION_ID]: variant === 'follow' ? null : 'workflows' },
    focusedWorkflowRunId:
      variant === 'follow' ? {} : { [PLAN_DRAWER_SESSION_ID]: PLAN_DRAWER_RUN_ID },
    drawer: {
      kind: 'artifact-document',
      sessionId: PLAN_DRAWER_SESSION_ID,
      payload: { artifactId: PLAN_DRAWER_PLAN_ID, revision: null },
    },
  });
  installSceneDatabase();
  installScenePlanEngine({
    sessionId: PLAN_DRAWER_SESSION_ID,
    isSaveConflict: variant === 'conflict',
    isReplyOnly: variant === 'unchanged',
  });
};
