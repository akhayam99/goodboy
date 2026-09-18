import type { ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import type {
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecordId,
} from '@goodboy/types';
import { AppFooter } from '../../AppFooter';
import { AppTopBar } from '../../AppTopBar';
import { ToastProvider } from '../../Toast';
import { SessionNavSidebar } from '../../../../features/session/components/SessionNavSidebar';
import { SessionCrumbBar } from '../../../../features/session/components/SessionCrumbBar';
import { useAppStore, type LensKind } from '../../../../store';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { shellArrangement } from '../../../shellArrangement';

const noop = () => undefined;

const CLAUDE_PROVIDER: ProviderInfo = {
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
  lens: LensKind;
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
      [session.id]: [
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
    providers: [CLAUDE_PROVIDER],
    notifications: [],
    notificationsLoading: false,
    notificationCounts: { total: 0, unread: 0 },
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
};

export const ShellFrame = ({ session, main }: ShellFrameProps) => {
  const arrangement = shellArrangement({
    hasWorkspace: true,
    hasActiveSession: true,
    isSidebarCollapsed: false,
  });

  return (
    <ToastProvider>
      <AppShell
        topBar={<AppTopBar onOpenSpend={noop} />}
        leftHidden={arrangement.leftHidden}
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={
          arrangement.leftSlot === 'sessions' ? (
            <SessionNavSidebar session={session} onCollapse={noop} />
          ) : undefined
        }
        footer={
          arrangement.hasFooter ? (
            <AppFooter
              activeStudio={null}
              githubEnabled
              linearEnabled
              jiraEnabled={false}
              sentryEnabled={false}
              gitlabEnabled={false}
              bitbucketEnabled={false}
              slackEnabled={false}
              onOpenWorkflows={noop}
              onOpenProviders={noop}
              onOpenSettings={noop}
              onOpenImpact={noop}
              onOpenChangelog={noop}
              onOpenGithub={noop}
              onOpenLinear={noop}
              onOpenJira={noop}
              onOpenSentry={noop}
              onOpenGitlab={noop}
              onOpenBitbucket={noop}
              onOpenInbox={noop}
              onOpenSlack={noop}
            />
          ) : undefined
        }
        main={
          <div className="flex h-full w-full min-w-0 flex-col">
            <div>
              <SessionCrumbBar />
            </div>
            <div className="min-h-0 flex-1">{main}</div>
          </div>
        }
        rightSidebar={null}
      />
    </ToastProvider>
  );
};
