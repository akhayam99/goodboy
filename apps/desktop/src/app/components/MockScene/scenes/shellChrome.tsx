import type { ReactNode } from 'react';
import { AppShell, UnderTrailContext } from '@goodboy/ui';
import type {
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecordId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { DrawerHost } from '../../DrawerHost';
import { useShellRight } from '../../../hooks/useShellRight';
import { AppTopBar } from '../../AppTopBar';
import { ShellLeft } from '../../ShellLeft';
import { SessionFrame } from '../../SessionRail/SessionFrame';
import { SessionHead } from '../../SessionHead';
import { SessionHeadContext } from '../../../../features/session/sessionHeadContext';
import { SessionHeadFrame } from '../../../../features/session/components/SessionHeadFrame';
import { ToastProvider } from '../../../../shared/components/Toast';
import { useAppStore, type LensKind } from '../../../../store';
import { DEFAULT_PREFS } from '../../../../store/slices/session-view/types';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import { sceneClock } from '../sceneClock';
import { shellArrangement } from '../../../shellArrangement';
import { useSceneShell } from './useSceneShell';
import { isDirectedScene } from '../../../../shared/utils/isDirectedScene';

const clock = sceneClock({ anchor: '2026-09-20T09:00:00.000Z' });

const noop = () => undefined;

const CLAUDE_PROVIDER: ProviderDisplayInfo = {
  id: 'anthropic',
  binary: 'claude',
  capabilities: {
    models: [],
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
    sessionViewPrefs: { [workspaceId]: DEFAULT_PREFS },
    sessionTelemetry: {
      ...state.sessionTelemetry,
      [session.id]: state.sessionTelemetry[session.id] ?? [
        {
          id: 'mock-surface-telemetry-turn' as TelemetryRecordId,
          runId: 'mock-surface-run-turn' as ProviderRunId,
          sessionId: session.id,
          kind: 'turn',
          provider: 'anthropic',
          model: 'claude-sonnet-5',
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
    ...(isDirectedScene() ? {} : { navigate: () => undefined }),
  });
};

type ShellFrameProps = {
  readonly session: Session;
  readonly main: ReactNode;
  readonly hasOwnTrail?: boolean;
};

export const ShellFrame = ({ session, main, hasOwnTrail = false }: ShellFrameProps) => {
  const shellRight = useShellRight({});
  const arrangement = shellArrangement({ hasWorkspace: true });
  const shell = useSceneShell({});

  return (
    <ToastProvider>
      <AppShell
        studio={shell.studio}
        topBar={<AppTopBar onOpenSpend={noop} onOpenScript={noop} />}
        drawer={shellRight.isDrawerMounted ? <DrawerHost slot="dock" /> : null}
        drawerSizing={shellRight.dockSizing}
        detail={shellRight.isDetailMounted ? <DrawerHost slot="detail" /> : null}
        detailSizing={shellRight.detailSizing}
        isDrawerParked={shellRight.isDrawerParked}
        isDetailParked={shellRight.isDetailParked}
        isDockInStudio={shellRight.isDockInStudio}
        rightRail={shellRight.rightRail}
        leftRail={
          <ShellLeft
            arrangement={arrangement}
            workspaceId={session.workspaceId}
            actions={shell.actions}
          />
        }
        main={
          <SessionFrame session={session}>
            {hasOwnTrail ? (
              main
            ) : (
              <SessionHeadFrame head={<SessionHead session={session} />}>
                <UnderTrailContext.Provider value>
                  <SessionHeadContext.Provider value={null}>
                    <div className="min-h-0 flex-1">{main}</div>
                  </SessionHeadContext.Provider>
                </UnderTrailContext.Provider>
              </SessionHeadFrame>
            )}
          </SessionFrame>
        }
      />
      {shell.layers}
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
    navigate: () => undefined,
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
    afterMerge: null,
    defaultBranchTemplate: null,
  },
  createdAt: clock.iso({ at: '2026-08-01T09:00:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-09-20T09:00:00.000Z' }),
});
