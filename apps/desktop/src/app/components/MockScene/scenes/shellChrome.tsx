import type { ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import type {
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecordId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { AppFooter } from '../../AppFooter';
import { AppTopBar } from '../../AppTopBar';
import { ToastProvider } from '../../Toast';
import { SessionNavSidebar } from '../../../../features/session/components/SessionNavSidebar';
import { CollapsedRail } from '../../../../features/session/components/SessionNavSidebar/parts/CollapsedRail';
import { SessionCrumbs } from '../../../../features/session/components/SessionCrumbBar/SessionCrumbs';
import { PageCrumbContext } from '../../../../shared/components/PaneShell/PageCrumbContext';
import { useAppStore, type LensKind } from '../../../../store';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import { shellArrangement } from '../../../shellArrangement';
import { sceneClock } from '../sceneClock';

const clock = sceneClock({ anchor: '2026-09-20T09:00:00.000Z' });

const noop = () => undefined;

const CLAUDE_PROVIDER: ProviderDisplayInfo = {
  id: 'anthropic',
  binary: 'claude',
  capabilities: {
    models: [],
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
  },
  connection: 'connected',
  version: '1.0.0',
  identity: 'mock-team',
  label: 'Claude',
  error: null,
  docsUrl: 'https://docs.claude.com/en/docs/claude-code/overview',
};

type ChromeParams = Readonly<{
  session: Session;
  siblings: ReadonlyArray<Session>;
  branches: Readonly<Record<string, string>>;
  telemetryAt: IsoDateTime;
  lens: LensKind | null;
}>;

export const seedShellChrome = ({
  session,
  siblings,
  branches,
  telemetryAt,
  lens,
}: ChromeParams): void => {
  const workspaceId = session.workspaceId;
  const state = useAppStore.getState();
  useAppStore.setState({
    currentSessionId: session.id as SessionId,
    activeLens: { ...state.activeLens, [session.id]: lens },
    sessions: [session, ...siblings],
    sessionBranches: { ...state.sessionBranches, ...branches },
    archivedSessions: { [workspaceId]: [] },
    sessionViewPrefs: { [workspaceId]: { sort: 'updatedAt', group: 'stage' } },
    sessionTelemetry: {
      ...state.sessionTelemetry,
      [session.id]: state.sessionTelemetry[session.id] ?? [
        {
          id: 'mock-surface-telemetry-turn' as TelemetryRecordId,
          runId: 'mock-surface-run-turn' as ProviderRunId,
          sessionId: session.id,
          kind: 'turn',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          recordedAt: telemetryAt,
          inputTokens: 22_140,
          outputTokens: 5_310,
          estimatedCostUsd: 0.212,
        },
      ],
    },
    providers: state.providers.length > 0 ? state.providers : [CLAUDE_PROVIDER],
    notifications: [],
    notificationsLoading: false,
    notificationCounts: [],
    loadNotifications: async () => undefined,
    markNotificationsRead: async () => undefined,
    clearNotifications: async () => undefined,
    loadArchivedSessions: async () => undefined,
    setCurrentSession: async () => undefined,
    setActiveLens: noop,
  });
};

type ShellFrameProps = {
  readonly session: Session;
  readonly main: ReactNode;
  readonly sidebar?: 'collapsed' | 'expanded';
};

export const ShellFrame = ({ session, main, sidebar = 'collapsed' }: ShellFrameProps) => {
  const arrangement = shellArrangement({
    hasWorkspace: true,
    hasActiveSession: true,
    isSidebarCollapsed: sidebar === 'collapsed',
  });

  return (
    <ToastProvider>
      <AppShell
        topBar={
          <AppTopBar
            sidebar={{
              hasSidebar: arrangement.leftSlot !== 'none',
              isCollapsed: arrangement.leftSlot === 'rail',
              onToggle: noop,
            }}
            onOpenSpend={noop}
            onOpenScript={noop}
          />
        }
        leftHidden={arrangement.leftHidden}
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={
          arrangement.leftSlot === 'sessions' ? (
            <SessionNavSidebar session={session} />
          ) : (
            <CollapsedRail />
          )
        }
        footer={
          <AppFooter
            scope={arrangement.footer}
            target={null}
            connected={{
              github: true,
              linear: true,
              jira: true,
              sentry: true,
              gitlab: false,
              bitbucket: false,
              slack: true,
            }}
            onOpenIntegration={noop}
            onOpenInbox={noop}
            onOpenWorkflows={noop}
            onOpenSettings={noop}
            onOpenShortcuts={noop}
            onOpenChangelog={noop}
          />
        }
        main={
          <PageCrumbContext.Provider value={<SessionCrumbs session={session} />}>
            <div className="flex h-full w-full min-w-0 flex-col">
              <div className="min-h-0 flex-1">{main}</div>
            </div>
          </PageCrumbContext.Provider>
        }
      />
    </ToastProvider>
  );
};

export const seedStudioChrome = (): void => {
  useAppStore.setState({
    notifications: [],
    notificationsLoading: false,
    notificationCounts: [],
    loadNotifications: async () => undefined,
    markNotificationsRead: async () => undefined,
    clearNotifications: async () => undefined,
    setCurrentSession: async () => undefined,
  });
};

type MockWorkspaceParams = Readonly<{
  id: WorkspaceId;
  name: string;
}>;

export const mockWorkspace = ({ id, name }: MockWorkspaceParams): Workspace => ({
  id,
  name,
  slug: name.toLowerCase(),
  overrides: {
    defaultProviderId: null,
    defaultBranchPrefix: null,
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
  },
  createdAt: clock.iso({ at: '2026-08-01T09:00:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-09-20T09:00:00.000Z' }),
});
