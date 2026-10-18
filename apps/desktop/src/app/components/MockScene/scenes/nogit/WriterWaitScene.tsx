import { useEffect, useState } from 'react';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type Project,
  type ProjectId,
  type ProviderRunId,
  type Session,
  type SessionId,
  type TurnEvent,
  type Workspace,
  type WorkspaceId,
} from '@goodboy/types';
import { ChatView } from '../../../../../features/chat/components/ChatView';
import { useAppStore } from '../../../../../store';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { ShellFrame, seedShellChrome } from '../shellChrome';

const MINUTE = 60_000;
const SCENE_MINUTES = 40;

type AtParams = Readonly<{ minute: number }>;

const at = ({ minute }: AtParams): IsoDateTime =>
  brandId<IsoDateTime>({
    value: new Date(Date.now() - (SCENE_MINUTES - minute) * MINUTE).toISOString(),
  });

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'mock-nogit-workspace-acme-notes' });
const NOTES_ID = brandId<ProjectId>({ value: 'mock-nogit-project-acme-notes' });
const WAITING_ID = brandId<SessionId>({ value: 'mock-nogit-session-interviews' });
const WRITING_ID = brandId<SessionId>({ value: 'mock-nogit-session-launch-memo' });
const FAQ_ID = brandId<SessionId>({ value: 'mock-nogit-session-faq' });
const WAITER_ID = brandId<AgentId>({ value: 'mock-nogit-agent-interviews' });
const WRITER_ID = brandId<AgentId>({ value: 'mock-nogit-agent-launch-memo' });
const READ_RUN = brandId<ProviderRunId>({ value: 'mock-nogit-run-read' });
const NOTES_PATH = '/mock/Documents/acme-notes';

type RunIdParams = Readonly<{ value: string }>;

const runId = ({ value }: RunIdParams): ProviderRunId => brandId<ProviderRunId>({ value });

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
  name: 'Acme notes',
  slug: 'acme-notes',
  overrides: OVERRIDES,
  createdAt: at({ minute: 0 }),
  updatedAt: at({ minute: SCENE_MINUTES }),
};

const NOTES: Project = {
  id: NOTES_ID,
  workspaceId: WORKSPACE_ID,
  name: 'acme-notes',
  rootPath: NOTES_PATH,
  kind: 'folder',
  overrides: OVERRIDES,
  createdAt: at({ minute: 0 }),
  updatedAt: at({ minute: SCENE_MINUTES }),
};

type SessionParams = Readonly<{ id: SessionId; goal: string; minute: number }>;

const sessionOf = ({ id, goal, minute }: SessionParams): Session => ({
  id,
  workspaceId: WORKSPACE_ID,
  goal,
  state: { kind: 'idle', lastActivityAt: at({ minute }) },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: at({ minute: 0 }),
  updatedAt: at({ minute }),
});

const WAITING = sessionOf({ id: WAITING_ID, goal: 'Summarize interview notes', minute: 39 });
const WRITING = sessionOf({ id: WRITING_ID, goal: 'Tighten the launch memo', minute: 38 });
const FAQ = sessionOf({ id: FAQ_ID, goal: 'Draft the FAQ', minute: 20 });

type AgentParams = Readonly<{ id: AgentId; sessionId: SessionId; name: string }>;

const agentOf = ({ id, sessionId, name }: AgentParams): Agent => ({
  id,
  sessionId,
  ordinal: 1,
  name,
  kind: 'generic',
  status: 'running',
  startedAt: at({ minute: 2 }),
  providerOverride: 'anthropic',
  modelOverride: 'claude-opus-5-5',
});

const WAITER = agentOf({ id: WAITER_ID, sessionId: WAITING_ID, name: 'Claude' });
const WRITER = agentOf({ id: WRITER_ID, sessionId: WRITING_ID, name: 'Claude' });

type PastTurnParams = Readonly<{ value: string; from: number; to: number }>;

const pastTurn = ({ value, from, to }: PastTurnParams): ReadonlyArray<TurnEvent> => [
  {
    kind: 'user_text',
    runId: runId({ value }),
    text: 'Tighten the intro',
    at: at({ minute: from }),
  },
  { kind: 'assistant_text', runId: runId({ value }), delta: 'Done.', at: at({ minute: to }) },
];

const WRITER_TRANSCRIPT: ReadonlyArray<TurnEvent> = [
  ...pastTurn({ value: 'mock-nogit-run-memo-1', from: 4, to: 8 }),
  ...pastTurn({ value: 'mock-nogit-run-memo-2', from: 12, to: 16 }),
];

const WAITER_TRANSCRIPT: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: READ_RUN,
    text: 'Read the interviews folder and list what people complained about most.',
    at: at({ minute: 30 }),
  },
  {
    kind: 'assistant_text',
    runId: READ_RUN,
    delta:
      'I read the 14 interviews in `interviews/`. The most common complaints are slow search, notes that do not sync between laptop and phone, and no way to share a single page. I can write these into `interviews/summary.md` when you want.',
    at: at({ minute: 31 }),
  },
];

type Props = {
  readonly theme: 'dark' | 'light';
};

export const WriterWaitScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      projects: [NOTES],
    });
    seedShellChrome({
      session: WAITING,
      siblings: [WRITING, FAQ],
      branches: {},
      telemetryAt: at({ minute: 31 }),
      lens: 'agents',
    });
    useAppStore.setState({
      selectedAgentId: { [WAITING_ID]: WAITER_ID, [WRITING_ID]: WRITER_ID },
      sessionPhaseRuns: { [WAITING_ID]: [WAITER], [WRITING_ID]: [WRITER] },
      transcripts: { [WAITER_ID]: WAITER_TRANSCRIPT, [WRITER_ID]: WRITER_TRANSCRIPT },
      agentTurnState: {
        [WAITER_ID]: { kind: 'starting', startedAt: at({ minute: 39 }) },
        [WRITER_ID]: {
          kind: 'running',
          runId: runId({ value: 'mock-nogit-run-memo-3' }),
          startedAt: at({ minute: 38 }),
        },
      },
      agentWriterWait: {
        [WAITER_ID]: {
          sessionId: WAITING_ID,
          blockedPath: NOTES_PATH,
          blockedBy: WRITER_ID,
          since: at({ minute: 39 }),
        },
      },
      sessionEvents: { [WAITING_ID]: [] },
      sessionProjectMounts: { [WAITING_ID]: [], [WRITING_ID]: [] },
      sessionWorktrees: { [WAITING_ID]: [] },
      sessionLoading: {
        [WAITING_ID]: {
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
      ensureProjectMounted: async () => ({ status: 'in-place', mountIds: [] }),
      recordSessionEvent: async () => undefined,
      answerWithoutEditing: () => true,
      cancelWriterWait: () => true,
    });
    setIsReady(true);
  }, [theme]);

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={WAITING} main={<ChatView session={WAITING} />} />;
};
