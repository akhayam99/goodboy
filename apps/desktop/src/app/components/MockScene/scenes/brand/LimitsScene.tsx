import { useEffect, useState } from 'react';
import type {
  Agent,
  AgentHandoff,
  AgentId,
  IsoDateTime,
  MountId,
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
import { ChatView } from '../../../../../features/chat/components/ChatView';
import { finish } from '../../../../../features/onboarding/onboarding-store';
import { useAppStore } from '../../../../../store';
import { ShellFrame, mockWorkspace, seedShellChrome } from '../shellChrome';
import {
  BRAND_MODELS,
  BRAND_OTHER_SESSIONS,
  BRAND_PROJECTS,
  BRAND_SESSION,
  BRAND_WORKSPACE_NAME,
} from './canon';
import { seedBrandLimits } from './limitsSeed';

const MINUTE = 60_000;
const SCENE_MINUTES = 64;

const at = (minute: number): IsoDateTime =>
  new Date(Date.now() - (SCENE_MINUTES - minute) * MINUTE).toISOString() as IsoDateTime;

const NOW = at(SCENE_MINUTES);
const STARTED = at(0);

const WORKSPACE_ID = 'mock-brand-limits-workspace' as WorkspaceId;
const SESSION_ID = 'mock-brand-limits-session' as SessionId;
const PAYMENTS_ID = 'mock-brand-limits-project-payments' as ProjectId;
const LEDGER_ID = 'mock-brand-limits-project-ledger' as ProjectId;
const RELAY_ID = 'mock-brand-limits-project-relay' as ProjectId;
const SCOUT_ID = 'mock-brand-limits-agent-scout' as AgentId;
const PLAN_ID = 'mock-brand-limits-agent-plan' as AgentId;
const IMPLEMENT_ID = 'mock-brand-limits-agent-implement' as AgentId;
const TEST_ID = 'mock-brand-limits-agent-test' as AgentId;
const CLAUDE_RUN = 'mock-brand-limits-run-test-claude' as ProviderRunId;
const SLUG = BRAND_WORKSPACE_NAME.toLowerCase();

const WORKSPACE: Workspace = mockWorkspace({ id: WORKSPACE_ID, name: BRAND_WORKSPACE_NAME });

const projectOf = (id: ProjectId, project: { name: string; rootPath: string }): Project => ({
  id,
  workspaceId: WORKSPACE_ID,
  name: project.name,
  rootPath: project.rootPath,
  kind: 'repo',
  baseBranch: 'main',
  overrides: WORKSPACE.overrides,
  createdAt: STARTED,
  updatedAt: NOW,
});

const PROJECTS: ReadonlyArray<Project> = [
  projectOf(PAYMENTS_ID, BRAND_PROJECTS.payments),
  projectOf(LEDGER_ID, BRAND_PROJECTS.ledger),
  projectOf(RELAY_ID, BRAND_PROJECTS.relay),
];

const mountOf = (projectId: ProjectId, name: string): SessionProjectMount => ({
  mountId: `mock-brand-limits-mount-${name}` as MountId,
  projectId,
  mountName: name,
  worktreePath: `~/code/${SLUG}/${name}-duplicate-credit`,
  lastWorktreePath: null,
  repoRoot: `~/code/${SLUG}/${name}`,
  branch: BRAND_SESSION.branch,
  baseBranch: 'main',
  parallelIndex: 0,
  diskState: 'present',
  revision: 1,
  sessionId: SESSION_ID,
  isAttached: true,
});

const MOUNTS: ReadonlyArray<SessionProjectMount> = [
  mountOf(PAYMENTS_ID, BRAND_PROJECTS.payments.name),
  mountOf(LEDGER_ID, BRAND_PROJECTS.ledger.name),
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

const SIBLINGS: ReadonlyArray<Session> = BRAND_OTHER_SESSIONS.map((other, index) => ({
  ...SESSION,
  id: `mock-brand-limits-sibling-${index}` as SessionId,
  goal: other.title,
  activeProjectId: undefined,
  state:
    other.stage === 'done'
      ? { kind: 'ended', endedAt: at(10 - index * 30) }
      : { kind: 'idle', lastActivityAt: at(40 - index * 12) },
  updatedAt: at(40 - index * 12),
}));

const SIBLING_BRANCHES = [
  'hl/reconcile-settlement-export',
  'hl/per-tenant-limits',
  'hl/retire-export-cron',
  'hl/payout-hold-warning',
  'hl/nightly-reconciliation',
];

const BRANCHES: Readonly<Record<string, string>> = Object.fromEntries([
  [SESSION_ID, BRAND_SESSION.branch],
  ...SIBLINGS.map((sibling, index) => [sibling.id, SIBLING_BRANCHES[index] ?? 'hl/work']),
]);

const AGENTS: ReadonlyArray<Agent> = [
  {
    id: SCOUT_ID,
    sessionId: SESSION_ID,
    ordinal: 1,
    name: 'Scout the webhook path',
    kind: 'scout',
    status: 'completed',
    startedAt: at(1),
    lastFinishedAt: at(5),
    lastViewedAt: at(5),
    providerOverride: BRAND_MODELS.scout.provider,
    modelOverride: BRAND_MODELS.scout.model,
  },
  {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    ordinal: 2,
    name: 'Plan the event id dedupe',
    kind: 'planner',
    status: 'completed',
    startedAt: at(6),
    lastFinishedAt: at(14),
    lastViewedAt: at(14),
    providerOverride: BRAND_MODELS.plan.provider,
    modelOverride: BRAND_MODELS.plan.model,
    effort: 'high',
  },
  {
    id: IMPLEMENT_ID,
    sessionId: SESSION_ID,
    ordinal: 3,
    name: 'Credit once per event id',
    kind: 'implementer',
    status: 'completed',
    startedAt: at(15),
    lastFinishedAt: at(44),
    lastViewedAt: at(44),
    providerOverride: BRAND_MODELS.implement.provider,
    modelOverride: BRAND_MODELS.implement.model,
  },
  {
    id: TEST_ID,
    sessionId: SESSION_ID,
    ordinal: 4,
    name: 'Test',
    kind: 'tester',
    status: 'completed',
    runId: CLAUDE_RUN,
    startedAt: at(45),
    lastFinishedAt: at(62),
    lastViewedAt: at(62),
    providerOverride: BRAND_MODELS.scout.provider,
    modelOverride: BRAND_MODELS.scout.model,
  },
];

const file = (project: string, relative: string): string =>
  `~/code/${SLUG}/${project}-duplicate-credit/${relative}`;

const ASK = `Run the redelivery suite in ${BRAND_PROJECTS.payments.name} and the postings suite in ${BRAND_PROJECTS.ledger.name}. Add a test that delivers the same event id three times and expects one credit.`;

const HANDOFF: AgentHandoff = {
  agentId: TEST_ID,
  sender: { kind: 'you' },
  ask: ASK,
  why: null,
  doneWhen: null,
  sections: [
    { kind: 'goal', summary: BRAND_SESSION.title, bodyMd: BRAND_SESSION.goal, refs: [] },
    {
      kind: 'plan',
      summary: 'Dedupe on the event id inside the transaction',
      bodyMd:
        'Keep the processor event id on every credit row, then dedupe on it inside the credit transaction.',
      refs: [],
    },
  ],
  sentSystem: null,
  sentMessage: ASK,
  provider: BRAND_MODELS.scout.provider,
  createdAt: at(45),
};

const TRANSCRIPT: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: CLAUDE_RUN,
    text: ASK,
    provider: BRAND_MODELS.scout.provider,
    model: BRAND_MODELS.scout.model,
    handoffId: TEST_ID,
    at: at(45),
  },
  {
    kind: 'tool_call_start',
    runId: CLAUDE_RUN,
    toolUseId: 'mock-brand-limits-tool-read',
    toolName: 'Read',
    input: { file_path: file(BRAND_PROJECTS.payments.name, 'src/webhooks/applyWebhook.ts') },
    at: at(47),
  },
  {
    kind: 'tool_call_end',
    runId: CLAUDE_RUN,
    toolUseId: 'mock-brand-limits-tool-read',
    output: '',
    isError: false,
    at: at(47),
  },
  {
    kind: 'file_edit',
    runId: CLAUDE_RUN,
    path: file(BRAND_PROJECTS.payments.name, 'test/webhooks/redelivery.test.ts'),
    editType: 'create',
    at: at(52),
  },
  {
    kind: 'tool_call_start',
    runId: CLAUDE_RUN,
    toolUseId: 'mock-brand-limits-tool-payments',
    toolName: 'Bash',
    input: { command: `pnpm --filter ${BRAND_PROJECTS.payments.name} test webhooks` },
    at: at(54),
  },
  {
    kind: 'tool_call_end',
    runId: CLAUDE_RUN,
    toolUseId: 'mock-brand-limits-tool-payments',
    output: 'Test Files  4 passed (4)\n     Tests  31 passed (31)',
    isError: false,
    at: at(57),
  },
  {
    kind: 'tool_call_start',
    runId: CLAUDE_RUN,
    toolUseId: 'mock-brand-limits-tool-ledger',
    toolName: 'Bash',
    input: { command: `pnpm --filter ${BRAND_PROJECTS.ledger.name} test postings` },
    at: at(58),
  },
  {
    kind: 'tool_call_end',
    runId: CLAUDE_RUN,
    toolUseId: 'mock-brand-limits-tool-ledger',
    output: 'Test Files  2 passed (2)\n     Tests  17 passed (17)',
    isError: false,
    at: at(60),
  },
  {
    kind: 'assistant_text',
    runId: CLAUDE_RUN,
    delta: `Both suites pass. The new redelivery test sends event \`evt_7Qm2\` three times: ${BRAND_PROJECTS.payments.name} posts one credit and answers 200 on the two repeats. Nothing still double-credits.`,
    at: at(62),
  },
  {
    kind: 'usage',
    runId: CLAUDE_RUN,
    usage: {
      inputTokens: 148_210,
      outputTokens: 6_940,
      cachedInputTokens: 121_400,
      cacheCreationInputTokens: 0,
      contextTokens: 58_300,
      estimatedCostUsd: 0.21,
    },
    at: at(62),
  },
  { kind: 'done', runId: CLAUDE_RUN, at: at(62) },
];

const task = (
  provider: SessionExternalTask['provider'],
  identifier: string,
  title: string,
): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider,
  externalId: `mock-brand-limits-${identifier}`,
  identifier,
  url: `https://example.invalid/${provider}/${identifier}`,
  title,
  createdAt: STARTED,
});

const EXTERNAL_TASKS: ReadonlyArray<SessionExternalTask> = [
  task('linear', BRAND_SESSION.issue, BRAND_SESSION.issueTitle),
  task('sentry', 'PAYMENTS-API-4F2', BRAND_SESSION.sentry),
];

export const BrandLimitsScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    finish();
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      projects: PROJECTS,
    });
    seedBrandLimits();
    seedShellChrome({
      session: SESSION,
      siblings: SIBLINGS,
      branches: BRANCHES,
      telemetryAt: at(62),
      lens: 'agents',
    });
    useAppStore.setState({
      selectedAgentId: { [SESSION_ID]: TEST_ID },
      sessionPhaseRuns: { [SESSION_ID]: AGENTS },
      transcripts: { [TEST_ID]: TRANSCRIPT },
      agentHandoffs: { [TEST_ID]: HANDOFF },
      loadAgentHandoff: async () => undefined,
      sessionEvents: { [SESSION_ID]: [] },
      sessionProjectMounts: { [SESSION_ID]: MOUNTS },
      sessionActiveProject: { [SESSION_ID]: PAYMENTS_ID },
      sessionWorktrees: { [SESSION_ID]: MOUNTS.map((mount) => mount.worktreePath) },
      sessionOpenQuestions: { [SESSION_ID]: [] },
      sessionAnsweredQuestions: { [SESSION_ID]: [] },
      sessionDismissedQuestions: { [SESSION_ID]: [] },
      sessionPlans: { [SESSION_ID]: [] },
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
