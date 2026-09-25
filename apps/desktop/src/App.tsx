import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AppFooter } from './app/components/AppFooter';
import type { SessionId } from '@goodboy/types';
import { BootSplash } from './app/components/BootSplash';
import { KeepAliveWorkSurface } from './app/components/KeepAliveWorkSurface';
import { AppTopBar } from './app/components/AppTopBar';
import { useAppShortcuts } from './app/hooks/useAppShortcuts';
import { useAppOverlays } from './app/hooks/useAppOverlays';
import { NoWorkspaceScreen } from './app/components/AppEmptyState';
import { StageBoard } from './features/workspace/components/StageBoard';
import { ToastProvider } from './app/components/Toast';
import { NotificationToastBridge } from './features/notifications/components/NotificationToastBridge';
import { WorkflowFollowToastBridge } from './features/workflows/components/WorkflowFollowToastBridge';
import { SessionNavSidebar } from './features/session/components/SessionNavSidebar';
import { NewSessionBridge } from './features/session/components/NewSessionBridge';
import { SessionArchiveBridge } from './features/session/components/SessionArchiveBridge';
import { CollapsedRail } from './features/session/components/SessionNavSidebar/parts/CollapsedRail';
import { SidebarPeekOverlay } from './features/workspace/components/SidebarPeekOverlay';
import { useWindowPresence } from './features/workspace/hooks/useWindowPresence';
import { isMainWindow } from './features/workspace/window';
import { primaryProjectRoot } from './features/workspace/primaryProjectRoot';
import { ReleaseNoticeBridge } from './features/changelog/components/ReleaseNoticeBridge';
import { OnboardingCard } from './features/onboarding/OnboardingCard';
import { openRunningScript } from './features/scripts/openRunningScript';
import type { RunningScript } from './features/scripts/hooks/useRunningScripts';
import { listenBridgeCommands } from './features/companion/commandExecutor';
import { listenProjectMaterializeRequests } from './features/session/projectMaterializeBridge';
import { listenMountCommands } from './features/session/mountQueryBridge';
import { startWorktreeWriterBridge } from './features/session/resolve/worktreeWriterBridge';
import { startPrWriteBridge } from './features/review/prWriteBridge';
import { useProviderRefreshOnFocus } from './shared/hooks/useProviderRefreshOnFocus';
import { useWindowShortcuts } from './shared/hooks/useWindowShortcuts';
import { useTitlebarInset } from './shared/hooks/useTitlebarInset';
import { useUnhandledRejectionNotice } from './shared/hooks/useUnhandledRejectionNotice';
import {
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessions,
  useWorkspaces,
} from './store';
import { useGithubPolling } from './features/github/hooks/useGithubPolling';
import { useUpdaterPolling } from './features/updater/hooks/useUpdaterPolling';
import { useConnectedIntegrations } from './features/integrations/hooks/useConnectedIntegrations';
import { useAsyncSubscription } from './app/hooks/useAsyncSubscription';
import { useSessionSidebarVisibility } from './features/workspace/hooks/useSessionSidebarVisibility';
import { shellArrangement } from './app/shellArrangement';
import { DrawerHost } from './app/components/DrawerHost';
import { useCloseStaleDrawer } from './app/hooks/useCloseStaleDrawer';
import { selectOpenDrawer } from './store/slices/drawer/selectOpenDrawer';

const KEEP_ALIVE_CAP = 5;

const openScript = (run: RunningScript) => {
  void openRunningScript({ run });
};

export const App = () => {
  const hydrate = useAppStore((s) => s.hydrate);
  const retryHydrate = useAppStore((s) => s.retryHydrate);
  const checkForUpdates = useAppStore((s) => s.checkForUpdates);
  const hydrated = useAppStore((s) => s.hydrated);
  const isDrawerOpen = useAppStore((s) => selectOpenDrawer(s) !== null);
  useCloseStaleDrawer();
  const bootPhase = useAppStore((s) => s.bootPhase);
  const bootFailedPhase = useAppStore((s) => s.bootFailedPhase);
  const error = useAppStore((s) => s.error);
  const newerDatabase = useAppStore((s) => s.newerDatabase);
  const restoreNewerDatabaseBackup = useAppStore((s) => s.restoreNewerDatabaseBackup);
  const quitApp = useAppStore((s) => s.quitApp);
  const [splashFinished, setSplashFinished] = useState(false);
  const workspaces = useWorkspaces();
  const hasWorkspaces = workspaces.length > 0;
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id ?? null;
  const workspaceProjectRoot = useAppStore((s) =>
    currentWorkspaceId == null
      ? null
      : primaryProjectRoot({ projects: s.projects, workspaceId: currentWorkspaceId }),
  );
  const currentSession = useCurrentSession();
  const currentWorkspaceSessions = useSessions();
  const hasActiveSession = currentSession != null;
  const sessionSidebar = useSessionSidebarVisibility({ hasActiveSession });
  const connected = useConnectedIntegrations({ workspaceId: currentWorkspaceId });
  const [keepAliveIds, setKeepAliveIds] = useState<ReadonlyArray<SessionId>>([]);
  const isWorkspaceLauncherBranch = hasWorkspaces && currentWorkspace === null && isMainWindow();
  const {
    footer,
    armDeleteConfirm,
    openAddWorkspace,
    openChangelog,
    openImpact,
    openInbox,
    openIntegration,
    openPalette,
    openProviders,
    openSettings,
    openShortcutHelp,
    openSpend,
    openWorkflows,
    studio,
    layers,
  } = useAppOverlays({
    connected,
    currentSession,
    currentWorkspace,
    workspaceProjectRoot,
    isSessionSidebarCollapsed: sessionSidebar.isCollapsed,
    isWorkspaceLauncherBranch,
    pinSessionSidebar: sessionSidebar.pin,
  });

  useEffect(() => {
    void hydrate();
    if (import.meta.env.PROD) {
      void checkForUpdates();
    }
  }, [hydrate, checkForUpdates]);

  useGithubPolling();
  useProviderRefreshOnFocus();
  useUpdaterPolling();
  useWindowPresence();
  useWindowShortcuts();
  useTitlebarInset();
  useUnhandledRejectionNotice();
  useAsyncSubscription({ start: listenBridgeCommands });
  useAsyncSubscription({ start: listenProjectMaterializeRequests });
  useAsyncSubscription({ start: listenMountCommands });
  useAsyncSubscription({ start: startWorktreeWriterBridge });
  useAsyncSubscription({ start: startPrWriteBridge });

  useEffect(() => {
    setKeepAliveIds([]);
  }, [currentWorkspace?.id]);

  useEffect(() => {
    const id = currentSession?.id ?? null;
    if (id === null) {
      return;
    }
    setKeepAliveIds((prev) => {
      if (prev[prev.length - 1] === id) {
        return prev;
      }
      const filtered = prev.filter((x) => x !== id);
      const next = [...filtered, id];
      return next.length > KEEP_ALIVE_CAP ? next.slice(next.length - KEEP_ALIVE_CAP) : next;
    });
  }, [currentSession?.id]);

  useAppShortcuts({
    armDeleteConfirm,
    openPalette,
    openSettings,
    openShortcutHelp,
    toggleSidebar: sessionSidebar.toggle,
  });

  const renderedSessionIds = useMemo<ReadonlyArray<SessionId>>(() => {
    const cid = currentSession?.id ?? null;
    if (!cid) {
      return keepAliveIds;
    }
    if (keepAliveIds.includes(cid)) {
      return keepAliveIds;
    }
    const merged = [...keepAliveIds, cid];
    return merged.length > KEEP_ALIVE_CAP ? merged.slice(merged.length - KEEP_ALIVE_CAP) : merged;
  }, [keepAliveIds, currentSession?.id]);

  const arrangement = shellArrangement({
    hasWorkspace: currentWorkspace != null,
    hasActiveSession,
    isSidebarCollapsed: sessionSidebar.isCollapsed,
  });

  const deferredRenderedIds = useDeferredValue(renderedSessionIds);
  const deferredActiveId = useDeferredValue(currentSession?.id ?? null);

  if (!hydrated || !splashFinished) {
    return (
      <BootSplash
        phase={bootPhase}
        failedPhase={bootFailedPhase}
        error={error}
        newerDatabase={newerDatabase}
        onRetry={retryHydrate}
        onRestoreBackup={restoreNewerDatabaseBackup}
        onQuit={() => void quitApp()}
        onFinished={() => setSplashFinished(true)}
      />
    );
  }

  if (isWorkspaceLauncherBranch) {
    return (
      <ToastProvider>
        <NotificationToastBridge />
        {layers}
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <NotificationToastBridge />
      <WorkflowFollowToastBridge />
      <NewSessionBridge />
      <SessionArchiveBridge />
      <ReleaseNoticeBridge onOpenChangelog={openChangelog} />
      <AppShell
        topBar={
          <AppTopBar
            sidebar={{
              hasSidebar: arrangement.leftSlot !== 'none',
              isCollapsed: sessionSidebar.isCollapsed,
              onToggle: sessionSidebar.toggle,
            }}
            onOpenSpend={openSpend}
            onOpenScript={openScript}
          />
        }
        footer={
          <AppFooter
            scope={arrangement.footer}
            target={footer}
            connected={connected}
            onOpenIntegration={openIntegration}
            onOpenInbox={openInbox}
            onOpenWorkflows={openWorkflows}
            onOpenProviders={openProviders}
            onOpenSettings={openSettings}
            onOpenImpact={openImpact}
            onOpenChangelog={openChangelog}
          />
        }
        leftHidden={arrangement.leftHidden}
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={
          currentSession && arrangement.leftSlot !== 'none' ? (
            arrangement.leftSlot === 'rail' ? (
              <CollapsedRail />
            ) : (
              <SessionNavSidebar session={currentSession} />
            )
          ) : undefined
        }
        leftOverlay={
          currentSession && arrangement.leftOverlaySlot === 'peek' ? (
            <SidebarPeekOverlay
              isPeeking={sessionSidebar.isPeeking}
              onEdgeEnter={sessionSidebar.requestPeek}
              onEdgeLeave={() => {
                sessionSidebar.cancelPeek();
                sessionSidebar.scheduleClose();
              }}
              onPanelEnter={sessionSidebar.cancelClose}
              onPanelLeave={sessionSidebar.scheduleClose}
              onHold={sessionSidebar.holdPeek}
              onRelease={sessionSidebar.releasePeek}
            >
              <SessionNavSidebar session={currentSession} onNavigate={sessionSidebar.closePeek} />
            </SidebarPeekOverlay>
          ) : undefined
        }
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        main={
          <div className="relative h-full w-full">
            {currentSession ? (
              <div className="relative h-full w-full">
                {deferredRenderedIds.map((id) => (
                  <KeepAliveWorkSurface
                    key={id}
                    sessionId={id}
                    isActive={id === deferredActiveId}
                  />
                ))}
              </div>
            ) : currentWorkspace ? (
              <StageBoard workspaceId={currentWorkspace.id} sessions={currentWorkspaceSessions} />
            ) : (
              <NoWorkspaceScreen onAddWorkspace={openAddWorkspace} />
            )}

            <OnboardingCard />
          </div>
        }
        studio={studio}
      />
      {layers}
    </ToastProvider>
  );
};
