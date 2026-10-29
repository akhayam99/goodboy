import { useEffect, useState } from 'react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  OpenQuestion,
  OpenQuestionId,
  PlanId,
  PlanWithCount,
  Project,
  ProjectId,
  ProviderRunId,
  Session,
  SessionExternalTask,
  SessionId,
  SessionProjectMount,
  TurnEvent,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { ChatView } from '../../../../features/chat/components/ChatView';
import { useAppStore } from '../../../../store';
import { ShellFrame, seedShellChrome } from './shellChrome';
import { BRAND_PROJECTS, BRAND_SESSION, BRAND_WORKSPACE_NAME } from './brand/canon';
import { seedBrandLimits } from './brand/limitsSeed';

const WORKSPACE_ID = 'mock-chat-workspace-cascadia' as WorkspaceId;
const SESSION_ID = 'mock-chat-session-webhook-credits' as SessionId;
const PAYMENTS_ID = 'mock-chat-project-payments-api' as ProjectId;
const CONSOLE_ID = 'mock-chat-project-notify-relay' as ProjectId;
const AGENT_ID = 'mock-chat-agent-implementer' as AgentId;
const ANSWERED_DELEGATE_ID = 'mock-chat-agent-answer-window' as AgentId;
const LIVE_DELEGATE_ID = 'mock-chat-agent-answer-banner' as AgentId;
const RUN_ID = 'mock-chat-run-implementer' as ProviderRunId;
const QUESTION_WINDOW_ID = 'mock-chat-question-window' as OpenQuestionId;
const QUESTION_BANNER_ID = 'mock-chat-question-banner' as OpenQuestionId;
const MINUTE = 60_000;
const SCENE_MINUTES = 42;

const at = (minute: number): IsoDateTime =>
  new Date(Date.now() - (SCENE_MINUTES - minute) * MINUTE).toISOString() as IsoDateTime;

const NOW = at(SCENE_MINUTES);
const STARTED = at(2);

const OVERRIDES = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
};

const WORKSPACE: Workspace = {
  id: WORKSPACE_ID,
  name: BRAND_WORKSPACE_NAME,
  slug: 'harborline',
  overrides: OVERRIDES,
  createdAt: STARTED,
  updatedAt: NOW,
};

const projectOf = (id: ProjectId, name: string): Project => ({
  id,
  workspaceId: WORKSPACE_ID,
  name,
  rootPath: `~/code/harborline/${name}`,
  kind: 'repo',
  overrides: OVERRIDES,
  createdAt: STARTED,
  updatedAt: NOW,
});

const PROJECTS: ReadonlyArray<Project> = [
  projectOf(PAYMENTS_ID, BRAND_PROJECTS.payments.name),
  projectOf(CONSOLE_ID, BRAND_PROJECTS.ledger.name),
];

const mountOf = (projectId: ProjectId, name: string, branch: string): SessionProjectMount => ({
  mountId: `mock-chat-mount-${name}` as MountId,
  projectId,
  mountName: name,
  worktreePath: `~/code/harborline/${name}-duplicate-credit`,
  lastWorktreePath: null,
  repoRoot: `~/code/harborline/${name}`,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  diskState: 'present',
  revision: 1,
  sessionId: SESSION_ID,
  isAttached: true,
});

const MOUNTS: ReadonlyArray<SessionProjectMount> = [
  mountOf(PAYMENTS_ID, BRAND_PROJECTS.payments.name, BRAND_SESSION.branch),
  mountOf(CONSOLE_ID, BRAND_PROJECTS.ledger.name, BRAND_SESSION.branch),
];

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: BRAND_SESSION.title,
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  activeProjectId: PAYMENTS_ID,
  createdAt: STARTED,
  updatedAt: NOW,
};

const sibling = (id: string, goal: string, minutesAgo: number): Session => ({
  ...SESSION,
  id: id as SessionId,
  goal,
  state: { kind: 'idle', lastActivityAt: at(40 - minutesAgo) },
  updatedAt: at(40 - minutesAgo),
});

const SIBLINGS: ReadonlyArray<Session> = [
  sibling('mock-chat-session-rate-limit', 'Per-tenant limits on the public API', 6),
  sibling('mock-chat-session-rounding', 'Nightly reconciliation before the Monday close', 14),
  sibling(
    'mock-chat-session-pagination',
    'Reconcile the settlement export against the ledger snapshot',
    22,
  ),
];

const AGENTS: ReadonlyArray<Agent> = [
  {
    id: AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 1,
    name: 'Credit once per event id',
    kind: 'implementer',
    status: 'completed',
    runId: RUN_ID,
    startedAt: STARTED,
    lastFinishedAt: at(38),
    lastViewedAt: at(38),
    providerOverride: 'anthropic',
    modelOverride: 'claude-opus-5-5',
  },
  {
    id: ANSWERED_DELEGATE_ID,
    sessionId: SESSION_ID,
    ordinal: 2,
    name: 'answer: How long should a processed event id be kept?',
    kind: 'implementer',
    status: 'completed',
    sourceKind: 'open_question',
    sourceThreadId: QUESTION_WINDOW_ID,
    startedAt: at(21),
    lastFinishedAt: at(23),
    providerOverride: 'codex',
    modelOverride: 'gpt-5.6-sol',
  },
  {
    id: LIVE_DELEGATE_ID,
    sessionId: SESSION_ID,
    ordinal: 3,
    name: 'answer: Should ledger-core keep a posting for a…',
    kind: 'implementer',
    status: 'stopped',
    sourceKind: 'open_question',
    sourceThreadId: QUESTION_BANNER_ID,
    startedAt: at(39),
    lastFinishedAt: at(40),
    providerOverride: 'gemini',
    modelOverride: 'gemini-3.1-pro',
  },
];

const PLAN_TEXT = [
  'The processor redelivers whenever payments-api takes longer than its timeout to acknowledge, and every redelivery posts a second credit.',
  '',
  '<<plan>>',
  '# Key the idempotency guard on the event id',
  '',
  "1. Record the processor's event id in a `processed_events` table before the credit is posted.",
  '2. Wrap the credit and the insert in one transaction, so a crash cannot split them.',
  '3. Answer 200 on a duplicate id without touching the invoice.',
  '4. Replay last week of webhooks in a dry run and diff every invoice balance.',
  '<</plan>>',
].join('\n');

const TRANSCRIPT: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: RUN_ID,
    text: BRAND_SESSION.goal,
    provider: 'anthropic',
    model: 'claude-opus-5-5',
    at: at(2),
  },
  { kind: 'assistant_text', runId: RUN_ID, delta: PLAN_TEXT, at: at(9) },
  {
    kind: 'file_edit',
    runId: RUN_ID,
    path: '~/code/harborline/payments-api-duplicate-credit/src/webhooks/applyWebhook.ts',
    editType: 'modify',
    at: at(28),
  },
  {
    kind: 'file_edit',
    runId: RUN_ID,
    path: '~/code/harborline/payments-api-duplicate-credit/migrations/0142_processed_events.sql',
    editType: 'create',
    at: at(29),
  },
  {
    kind: 'file_edit',
    runId: RUN_ID,
    path: '~/code/harborline/payments-api-duplicate-credit/test/webhooks/redelivery.test.ts',
    editType: 'create',
    at: at(31),
  },
  {
    kind: 'assistant_text',
    runId: RUN_ID,
    delta:
      'The guard is in and the redelivery test posts the same event three times against one credit. One call left on the ledger-core side before I touch it.',
    at: at(38),
  },
  { kind: 'done', runId: RUN_ID, at: at(38) },
];

const QUESTIONS_ANSWERED: ReadonlyArray<OpenQuestion> = [
  {
    id: QUESTION_WINDOW_ID,
    sessionId: SESSION_ID,
    createdByAgentId: AGENT_ID,
    turnOrdinal: 1,
    text: 'How long should a processed event id be kept?',
    suggestedAnswers: ['7 days', '30 days', 'Forever'],
    recommendedAnswer: '30 days',
    selectMode: 'one',
    isBlocking: false,
    userAnswer:
      '30 days: the processor stops redelivering after 3 days, the rest covers manual replays.',
    answerSource: 'agent',
    answeredByAgentId: ANSWERED_DELEGATE_ID,
    status: 'answered',
    createdAt: at(20),
    answeredAt: at(23),
    answerDeliveredAt: at(23),
  },
];

const QUESTIONS_OPEN: ReadonlyArray<OpenQuestion> = [
  {
    id: QUESTION_BANNER_ID,
    sessionId: SESSION_ID,
    createdByAgentId: AGENT_ID,
    turnOrdinal: 1,
    text: 'Should ledger-core keep a posting for a duplicate event, or skip it?',
    suggestedAnswers: [
      'Skip it: one posting per event id',
      'Keep it, marked as a duplicate',
      'Both',
    ],
    recommendedAnswer: 'Skip it: one posting per event id',
    selectMode: 'one',
    isBlocking: true,
    userAnswer: null,
    status: 'open',
    createdAt: at(38),
  },
];

const PLANS: ReadonlyArray<PlanWithCount> = [
  {
    id: 'mock-chat-plan-idempotency' as PlanId,
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    title: 'Key the idempotency guard on the event id',
    bodyMd: PLAN_TEXT,
    status: 'active',
    createdAt: at(9),
    updatedAt: at(9),
    consumptionCount: 1,
  },
];

const task = (
  provider: SessionExternalTask['provider'],
  identifier: string,
  title: string,
): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider,
  externalId: `mock-chat-${identifier}`,
  identifier,
  url: `https://example.invalid/${provider}/${identifier}`,
  title,
  createdAt: STARTED,
});

const EXTERNAL_TASKS: ReadonlyArray<SessionExternalTask> = [
  task('linear', BRAND_SESSION.issue, BRAND_SESSION.issueTitle),
  task('sentry', 'PAYMENTS-API-4F2', BRAND_SESSION.sentry),
];

export const ChatShellScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      projects: PROJECTS,
    });
    seedBrandLimits();
    seedShellChrome({
      session: SESSION,
      siblings: SIBLINGS,
      branches: {
        [SESSION_ID]: BRAND_SESSION.branch,
        'mock-chat-session-rate-limit': 'hl/per-tenant-limits',
        'mock-chat-session-rounding': 'hl/nightly-reconciliation',
        'mock-chat-session-pagination': 'hl/reconcile-settlement-export',
      },
      telemetryAt: at(38),
      lens: 'agents',
    });
    useAppStore.setState({
      selectedAgentId: { [SESSION_ID]: AGENT_ID },
      sessionPhaseRuns: { [SESSION_ID]: AGENTS },
      transcripts: { [AGENT_ID]: TRANSCRIPT },
      sessionEvents: { [SESSION_ID]: [] },
      sessionProjectMounts: { [SESSION_ID]: MOUNTS },
      sessionActiveProject: { [SESSION_ID]: PAYMENTS_ID },
      sessionWorktrees: { [SESSION_ID]: MOUNTS.map((mount) => mount.worktreePath) },
      sessionOpenQuestions: { [SESSION_ID]: QUESTIONS_OPEN },
      sessionAnsweredQuestions: { [SESSION_ID]: QUESTIONS_ANSWERED },
      sessionDismissedQuestions: { [SESSION_ID]: [] },
      sessionPlans: { [SESSION_ID]: PLANS },
      sessionExternalTasks: { [SESSION_ID]: EXTERNAL_TASKS },
      sessionLoading: {
        [SESSION_ID]: {
          agents: false,
          transcript: false,
          telemetry: false,
          slots: false,
          plans: false,
          summary: false,
        },
      },
      loadSessionEvents: async () => undefined,
      loadSessionOpenQuestions: async () => undefined,
      loadSessionAnsweredQuestions: async () => undefined,
      loadSessionDismissedQuestions: async () => undefined,
      loadAgentTranscript: async () => undefined,
      navigate: () => undefined,
      markAgentViewed: async () => undefined,
      refreshProviders: async () => undefined,
      ensureProjectMounted: async () => undefined,
      recordSessionEvent: async () => undefined,
    } as never);
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={SESSION} main={<ChatView session={SESSION} />} />;
};
