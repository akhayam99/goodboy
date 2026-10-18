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
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { ChatView } from '../../../../../features/chat/components/ChatView';
import { useAppStore, type LensKind } from '../../../../../store';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { mockSceneIpc } from '../mockSceneIpc';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import {
  CHANGES_NOTES_PATH,
  CHANGES_SESSION_ID,
  CHANGES_TITLES,
  changesRead,
  changesRestore,
  changesWorld,
} from './changesSeed';

type ChangesSceneView = 'list' | 'conflict' | 'restored' | 'added' | 'overview' | 'chat';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly view: ChangesSceneView;
};

const MINUTE = 60_000;

type AtParams = Readonly<{ minutesAgo: number }>;

const at = ({ minutesAgo }: AtParams): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(Date.now() - minutesAgo * MINUTE).toISOString() });

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'mock-nogit-workspace-acme-notes' });
const NOTES_ID = brandId<ProjectId>({ value: 'mock-nogit-project-acme-notes' });
const WRITER_ID = brandId<AgentId>({ value: 'mock-nogit-agent-launch-memo' });

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
  createdAt: at({ minutesAgo: 90 }),
  updatedAt: at({ minutesAgo: 2 }),
};

const NOTES: Project = {
  id: NOTES_ID,
  workspaceId: WORKSPACE_ID,
  name: 'acme-notes',
  rootPath: CHANGES_NOTES_PATH,
  kind: 'folder',
  overrides: OVERRIDES,
  createdAt: at({ minutesAgo: 90 }),
  updatedAt: at({ minutesAgo: 2 }),
};

type SessionParams = Readonly<{ id: SessionId; goal: string; minutesAgo: number }>;

const sessionOf = ({ id, goal, minutesAgo }: SessionParams): Session => ({
  id,
  workspaceId: WORKSPACE_ID,
  goal,
  state: { kind: 'idle', lastActivityAt: at({ minutesAgo }) },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: at({ minutesAgo: 90 }),
  updatedAt: at({ minutesAgo }),
});

const MEMO = sessionOf({ id: CHANGES_SESSION_ID, goal: 'Tighten the launch memo', minutesAgo: 2 });
const INTERVIEWS = sessionOf({
  id: brandId<SessionId>({ value: 'mock-nogit-session-interviews' }),
  goal: 'Summarize interview notes',
  minutesAgo: 30,
});
const FAQ = sessionOf({
  id: brandId<SessionId>({ value: 'mock-nogit-session-faq' }),
  goal: 'Draft the FAQ',
  minutesAgo: 50,
});

const WRITER: Agent = {
  id: WRITER_ID,
  sessionId: CHANGES_SESSION_ID,
  ordinal: 1,
  name: 'Claude',
  kind: 'generic',
  status: 'completed',
  startedAt: at({ minutesAgo: 62 }),
  providerOverride: 'anthropic',
  modelOverride: 'claude-opus-5-5',
};

const TRANSCRIPT: ReadonlyArray<TurnEvent> = CHANGES_TITLES.flatMap(
  ({ runId, text, reply }, index): ReadonlyArray<TurnEvent> => {
    const run = brandId<ProviderRunId>({ value: runId });
    const minutesAgo = 62 - index * 24;
    return [
      { kind: 'user_text', runId: run, text, at: at({ minutesAgo }) },
      { kind: 'assistant_text', runId: run, delta: reply, at: at({ minutesAgo: minutesAgo - 1 }) },
      {
        kind: 'usage',
        runId: run,
        usage: {
          inputTokens: 18_200,
          outputTokens: 2_140,
          cachedInputTokens: 12_000,
          estimatedCostUsd: 0.07,
        },
        at: at({ minutesAgo: minutesAgo - 2 }),
      },
    ];
  },
);

type FieldParams = Readonly<{ payload: unknown; name: string }>;

type PayloadParams = Readonly<{ payload: unknown }>;

const argsOf = ({ payload }: PayloadParams): unknown =>
  typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'args') : undefined;

const textField = ({ payload, name }: FieldParams): string => {
  const args = argsOf({ payload });
  const value: unknown = typeof args === 'object' && args !== null ? Reflect.get(args, name) : '';
  return typeof value === 'string' ? value : '';
};

const pathsField = ({ payload, name }: FieldParams): ReadonlyArray<string> | null => {
  const args = argsOf({ payload });
  const value: unknown =
    typeof args === 'object' && args !== null ? Reflect.get(args, name) : undefined;
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : null;
};

const flagField = ({ payload, name }: FieldParams): boolean => {
  const args = argsOf({ payload });
  return typeof args === 'object' && args !== null && Reflect.get(args, name) === true;
};

type Step = Readonly<{ label: string }>;

const STEPS: Readonly<Record<ChangesSceneView, ReadonlyArray<Step>>> = {
  list: [],
  conflict: [{ label: 'Restore to before turn 3' }],
  restored: [{ label: 'Restore to before turn 3' }, { label: 'Restore anyway' }],
  added: [{ label: 'interviews/summary.md, turn 2' }],
  overview: [],
  chat: [],
};

const LENS_OF = {
  list: 'files',
  conflict: 'files',
  restored: 'files',
  added: 'files',
  overview: null,
  chat: 'agents',
} as const satisfies Record<ChangesSceneView, LensKind | null>;

type FindParams = Readonly<{ label: string }>;

const buttonFor = ({ label }: FindParams): HTMLButtonElement | null =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) =>
      !button.disabled &&
      (button.getAttribute('aria-label') === label || button.textContent?.trim() === label),
  ) ?? null;

const DRIVE_EVERY_MS = 120;
const DRIVE_TRIES = 60;

export const ChangesScene = ({ theme, view }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    const world = changesWorld();
    if (view !== 'list' && view !== 'added') {
      world.changedSince = ['launch-memo.md'];
    }
    mockSceneIpc((command, payload) => {
      if (command === 'file_versions_folder_list_turns') {
        return world.turns;
      }
      if (command === 'file_versions_folder_read') {
        return changesRead({
          runId: textField({ payload, name: 'runId' }),
          relativePath: textField({ payload, name: 'relativePath' }),
          side: textField({ payload, name: 'side' }),
        });
      }
      if (command === 'file_versions_folder_restore') {
        return changesRestore({
          world,
          runId: textField({ payload, name: 'runId' }),
          restoreRunId: textField({ payload, name: 'restoreRunId' }),
          isForced: flagField({ payload, name: 'isForced' }),
          relativePaths: pathsField({ payload, name: 'relativePaths' }),
        });
      }
      if (command === 'file_versions_folder_size') {
        return {
          folderPath: CHANGES_NOTES_PATH,
          isReady: true,
          fileCount: 86,
          keptBytes: 42 * 1024 * 1024,
          versionBytes: 18 * 1024 * 1024,
          versionCount: 12,
          capBytes: 1024 * 1024 * 1024,
        };
      }
      return null;
    });
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      projects: [NOTES],
      folderPurpose: { [NOTES_ID]: 'documents' },
    });
    seedShellChrome({
      session: MEMO,
      siblings: [INTERVIEWS, FAQ],
      branches: { [CHANGES_SESSION_ID]: '' },
      telemetryAt: at({ minutesAgo: 2 }),
      lens: LENS_OF[view],
    });
    useAppStore.setState({
      ...(view === 'chat' && { selectedAgentId: { [CHANGES_SESSION_ID]: WRITER_ID } }),
      sessionPhaseRuns: { [CHANGES_SESSION_ID]: [WRITER] },
      sessionPlans: { [CHANGES_SESSION_ID]: [] },
      transcripts: { [WRITER_ID]: TRANSCRIPT },
      sessionEvents: { [CHANGES_SESSION_ID]: [] },
      sessionProjectMounts: { [CHANGES_SESSION_ID]: [] },
      sessionWorktrees: { [CHANGES_SESSION_ID]: [] },
      sessionLoading: {
        [CHANGES_SESSION_ID]: {
          agents: false,
          transcript: false,
          telemetry: false,
          slots: false,
          plans: false,
          summary: false,
        },
      },
      loadSessionEvents: async () => undefined,
      loadPhaseRunsForSession: async () => undefined,
      loadSessionPlans: async () => undefined,
      loadSessionOpenQuestions: async () => undefined,
      loadSessionAnsweredQuestions: async () => undefined,
      loadSessionDismissedQuestions: async () => undefined,
      loadAgentTranscript: async () => undefined,
      navigate: () => undefined,
      markAgentViewed: async () => undefined,
      refreshProviders: async () => undefined,
      recordSessionEvent: async () => undefined,
    });
    setIsReady(true);
  }, [theme, view]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const steps = [...STEPS[view]];
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const step = steps[0];
      if (step === undefined || tries > DRIVE_TRIES) {
        window.clearInterval(timer);
        return;
      }
      const button = buttonFor({ label: step.label });
      if (button === null) {
        return;
      }
      button.click();
      steps.shift();
    }, DRIVE_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [isReady, view]);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={MEMO}
      main={
        view === 'chat' ? <ChatView session={MEMO} /> : <SessionWorkspace session={MEMO} isActive />
      }
    />
  );
};
