import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import type {
  Agent,
  AgentHandoff,
  AgentId,
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IntegrationDraft,
  IntegrationDraftId,
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  ProviderRunId,
  Session,
  SessionExternalTask,
  SessionId,
  SessionProjectMount,
  TelemetryRecordId,
  TurnEvent,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { ChatView } from '../../../../../features/chat/components/ChatView';
import { useAppStore } from '../../../../../store';
import { ShellFrame, mockWorkspace, seedShellChrome } from '../shellChrome';
import {
  BRAND_MODELS,
  BRAND_OTHER_SESSIONS,
  BRAND_PEOPLE,
  BRAND_PROJECTS,
  BRAND_SESSION,
  BRAND_WORKSPACE_NAME,
} from './canon';
import { seedBrandLimits } from './limitsSeed';
import {
  SLACK_DRAFT_BODY,
  SLACK_ONCALL_CHANNEL,
  SLACK_THREAD,
  SLACK_THREAD_TS,
  SLACK_USERS,
} from './slackThread';

const MINUTE = 60_000;
const SCENE_MINUTES = 58;

const at = (minute: number): IsoDateTime =>
  new Date(Date.now() - (SCENE_MINUTES - minute) * MINUTE).toISOString() as IsoDateTime;

const NOW = at(SCENE_MINUTES);
const STARTED = at(0);

const WORKSPACE_ID = 'mock-brand-slack-workspace' as WorkspaceId;
const SESSION_ID = 'mock-brand-slack-session' as SessionId;
const PAYMENTS_ID = 'mock-brand-slack-project-payments' as ProjectId;
const LEDGER_ID = 'mock-brand-slack-project-ledger' as ProjectId;
const RELAY_ID = 'mock-brand-slack-project-relay' as ProjectId;
const PLAN_AGENT_ID = 'mock-brand-slack-agent-plan' as AgentId;
const AGENT_ID = 'mock-brand-slack-agent-implement' as AgentId;
const RUN_ID = 'mock-brand-slack-run-implement' as ProviderRunId;
const SLUG = BRAND_WORKSPACE_NAME.toLowerCase();

const WORKSPACE: Workspace = mockWorkspace({ id: WORKSPACE_ID, name: BRAND_WORKSPACE_NAME });

const projectOf = (id: ProjectId, project: { name: string; rootPath: string }): Project => ({
  id,
  workspaceId: WORKSPACE_ID,
  name: project.name,
  rootPath: project.rootPath,
  kind: 'repo',
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
  mountId: `mock-brand-slack-mount-${name}` as MountId,
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
  id: `mock-brand-slack-sibling-${index}` as SessionId,
  goal: other.title,
  activeProjectId: undefined,
  state:
    other.stage === 'done'
      ? { kind: 'ended', endedAt: at(10 - index * 30) }
      : { kind: 'idle', lastActivityAt: at(40 - index * 12) },
  updatedAt: at(40 - index * 12),
}));

const AGENTS: ReadonlyArray<Agent> = [
  {
    id: PLAN_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 1,
    name: 'Plan the event id dedupe',
    kind: 'planner',
    status: 'completed',
    startedAt: at(1),
    lastFinishedAt: at(9),
    lastViewedAt: at(9),
    providerOverride: BRAND_MODELS.plan.provider,
    modelOverride: BRAND_MODELS.plan.model,
  },
  {
    id: AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 2,
    name: 'Credit once per event id',
    kind: 'implementer',
    status: 'completed',
    runId: RUN_ID,
    startedAt: at(10),
    lastFinishedAt: at(56),
    lastViewedAt: at(56),
    providerOverride: BRAND_MODELS.implement.provider,
    modelOverride: BRAND_MODELS.implement.model,
  },
];

const ASK = `Build the plan: dedupe on the processor event id inside the credit transaction in ${BRAND_PROJECTS.payments.name}, and record each retry in ${BRAND_PROJECTS.relay.name}. Leave ${BRAND_PROJECTS.ledger.name} as it is. When both PRs are up, draft a reply to ${BRAND_PEOPLE.oncall.name} in #${SLACK_ONCALL_CHANNEL.name}.`;

const HANDOFF: AgentHandoff = {
  agentId: AGENT_ID,
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
    {
      kind: 'files',
      summary: '2 files',
      bodyMd: 'The webhook handler and the posting guard.',
      refs: [
        { kind: 'file', label: 'src/webhooks/applyWebhook.ts', path: null },
        { kind: 'file', label: 'src/postings/guard.ts', path: null },
      ],
    },
  ],
  sentSystem: null,
  sentMessage: ASK,
  provider: BRAND_MODELS.implement.provider,
  createdAt: at(10),
};

const path = (project: string, file: string): string =>
  `~/code/${SLUG}/${project}-duplicate-credit/${file}`;

const TRANSCRIPT: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: RUN_ID,
    text: ASK,
    provider: BRAND_MODELS.implement.provider,
    model: BRAND_MODELS.implement.model,
    handoffId: AGENT_ID,
    at: at(10),
  },
  {
    kind: 'tool_call_start',
    runId: RUN_ID,
    toolUseId: 'mock-brand-slack-tool-grep',
    toolName: 'Grep',
    input: { pattern: 'applyWebhook', path: path(BRAND_PROJECTS.payments.name, 'src') },
    at: at(11),
  },
  {
    kind: 'tool_call_end',
    runId: RUN_ID,
    toolUseId: 'mock-brand-slack-tool-grep',
    output: 'src/webhooks/applyWebhook.ts\nsrc/webhooks/router.ts',
    isError: false,
    at: at(11),
  },
  {
    kind: 'tool_call_start',
    runId: RUN_ID,
    toolUseId: 'mock-brand-slack-tool-read',
    toolName: 'Read',
    input: { file_path: path(BRAND_PROJECTS.payments.name, 'src/webhooks/applyWebhook.ts') },
    at: at(12),
  },
  {
    kind: 'tool_call_end',
    runId: RUN_ID,
    toolUseId: 'mock-brand-slack-tool-read',
    output: '',
    isError: false,
    at: at(12),
  },
  {
    kind: 'assistant_text',
    runId: RUN_ID,
    delta:
      'Found it. `applyWebhook` checks for the event id before it opens the transaction, so two deliveries 40 seconds apart both pass the check and both credit the account.',
    at: at(14),
  },
  {
    kind: 'file_edit',
    runId: RUN_ID,
    path: path(BRAND_PROJECTS.payments.name, 'src/webhooks/applyWebhook.ts'),
    editType: 'modify',
    at: at(26),
  },
  {
    kind: 'file_edit',
    runId: RUN_ID,
    path: path(BRAND_PROJECTS.payments.name, 'migrations/0187_processed_events.sql'),
    editType: 'create',
    at: at(27),
  },
  {
    kind: 'file_edit',
    runId: RUN_ID,
    path: path(BRAND_PROJECTS.ledger.name, 'src/postings/guard.ts'),
    editType: 'modify',
    at: at(38),
  },
  {
    kind: 'file_edit',
    runId: RUN_ID,
    path: path(BRAND_PROJECTS.payments.name, 'test/webhooks/redelivery.test.ts'),
    editType: 'create',
    at: at(41),
  },
  {
    kind: 'assistant_text',
    runId: RUN_ID,
    delta:
      'The credit and the event id insert now share one transaction, so a retry that lands mid-flight waits on the row lock and then sees the id. ledger-core already holds one posting per event id, so it stays as it is.',
    at: at(42),
  },
  {
    kind: 'tool_call_start',
    runId: RUN_ID,
    toolUseId: 'mock-brand-slack-tool-test',
    toolName: 'Bash',
    input: { command: 'pnpm test webhooks postings' },
    at: at(44),
  },
  {
    kind: 'tool_call_end',
    runId: RUN_ID,
    toolUseId: 'mock-brand-slack-tool-test',
    output: 'Test Files  6 passed (6)\n     Tests  48 passed (48)',
    isError: false,
    at: at(46),
  },
  {
    kind: 'assistant_text',
    runId: RUN_ID,
    delta: `Both PRs are up: ${BRAND_PROJECTS.payments.name} #${BRAND_SESSION.paymentsPr} and ${BRAND_PROJECTS.relay.name} #57, with ${BRAND_PEOPLE.reviewer.name} as reviewer. The redelivery test posts the same event three times and gets one credit. I drafted the reply to ${BRAND_PEOPLE.oncall.name} below. It stays here until you send it.`,
    at: at(56),
  },
  { kind: 'done', runId: RUN_ID, at: at(56) },
];

const DRAFT: IntegrationDraft = {
  id: 'mock-brand-slack-draft' as IntegrationDraftId,
  workspaceId: WORKSPACE_ID,
  sessionId: SESSION_ID,
  provider: 'slack',
  verb: 'reply',
  target: { channelId: SLACK_ONCALL_CHANNEL.id, threadTs: SLACK_THREAD_TS },
  body: SLACK_DRAFT_BODY,
  status: 'pending',
  createdAt: at(56),
  updatedAt: at(56),
  decidedAt: null,
};

const task = (
  provider: SessionExternalTask['provider'],
  identifier: string,
  title: string,
): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider,
  externalId: `mock-brand-slack-${identifier}`,
  identifier,
  url: `https://example.invalid/${provider}/${identifier}`,
  title,
  createdAt: STARTED,
});

const EXTERNAL_TASKS: ReadonlyArray<SessionExternalTask> = [
  task('linear', BRAND_SESSION.issue, BRAND_SESSION.issueTitle),
  task('sentry', 'PAYMENTS-API-4F2', BRAND_SESSION.sentry),
];

const SLACK_BINDING: IntegrationBinding = {
  id: 'mock-brand-slack-binding' as IntegrationBindingId,
  workspaceId: WORKSPACE_ID,
  projectId: null,
  credentialId: 'mock-brand-slack-credential' as IntegrationCredentialId,
  provider: 'slack',
  config: {
    teamId: 'T0MOCKHBL',
    teamName: BRAND_WORKSPACE_NAME,
    userId: 'U0MOCKDANA',
    userName: BRAND_PEOPLE.owner.name,
    followedChannels: [{ id: SLACK_ONCALL_CHANNEL.id, name: SLACK_ONCALL_CHANNEL.name }],
    hasSelectedChannels: true,
    includePrivate: false,
    agentPolicy: { readFollowed: 'allow', readOthers: 'off', reply: 'ask', react: 'allow' },
    signature: { agents: true, own: false, text: '' },
  },
  createdAt: STARTED,
  updatedAt: STARTED,
};

const BRANCHES: Readonly<Record<string, string>> = Object.fromEntries([
  [SESSION_ID, BRAND_SESSION.branch],
  ...SIBLINGS.map((sibling, index) => [sibling.id, `hl/session-${index + 1}`]),
]);

const installIpc = (): void => {
  mockIPC((cmd) => {
    if (cmd === 'slack_get_thread') {
      return SLACK_THREAD;
    }
    if (cmd === 'slack_list_users') {
      return SLACK_USERS;
    }
    if (cmd === 'slack_list_channels') {
      return [SLACK_ONCALL_CHANNEL];
    }
    throw new Error(`${cmd} is not available in the brand scene`);
  });
};

export const BrandSlackScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installIpc();
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      projects: PROJECTS,
      sessionTelemetry: {
        [SESSION_ID]: [
          {
            id: 'mock-brand-slack-telemetry' as TelemetryRecordId,
            runId: RUN_ID,
            sessionId: SESSION_ID,
            kind: 'turn',
            provider: BRAND_MODELS.implement.provider,
            model: BRAND_MODELS.implement.model,
            recordedAt: at(56),
            inputTokens: 412_800,
            outputTokens: 38_900,
            estimatedCostUsd: BRAND_SESSION.cost,
          },
        ],
      },
    });
    seedBrandLimits();
    seedShellChrome({
      session: SESSION,
      siblings: SIBLINGS,
      branches: BRANCHES,
      telemetryAt: at(56),
      lens: 'agents',
    });
    useAppStore.setState({
      selectedAgentId: { [SESSION_ID]: AGENT_ID },
      sessionPhaseRuns: { [SESSION_ID]: AGENTS },
      transcripts: { [AGENT_ID]: TRANSCRIPT },
      agentHandoffs: { [AGENT_ID]: HANDOFF },
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
      sessionSlackDrafts: { [SESSION_ID]: [DRAFT] },
      workspaceIntegrations: { [WORKSPACE_ID]: [SLACK_BINDING] },
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
      loadSessionSlackDrafts: async () => undefined,
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
