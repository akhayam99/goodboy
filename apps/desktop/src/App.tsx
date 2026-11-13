import { UndoToastBridge } from './app/components/UndoToastBridge';
import { AnnouncementRegion } from './app/components/AnnouncementRegion';
import { NeedsYouAnnouncementBridge } from './app/components/NeedsYouAnnouncementBridge';
import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { AppBootSplash } from './app/components/BootSplash/AppBootSplash';
import { BootSplashExit } from './app/components/BootSplash/BootSplashExit';
import { MainRegion } from './app/components/MainRegion';
import { AppTopBar } from './app/components/AppTopBar';
import { useAppShortcuts } from './app/hooks/useAppShortcuts';
import { useAppOverlays } from './app/hooks/useAppOverlays';
import { ToastProvider } from './shared/components/Toast';
import { ObjectMenuProvider } from './features/actions/components/ObjectMenuProvider';
import { NotificationToastBridge } from './features/notifications/components/NotificationToastBridge';
import { AwayAlertsBridge } from './features/notifications/components/AwayAlertsBridge';
import { WorkflowFollowToastBridge } from './features/workflows/components/WorkflowFollowToastBridge';
import { ScriptEndToastBridge } from './features/scripts/components/ScriptEndToastBridge';
import { NewSessionBridge } from './features/session/components/NewSessionBridge';
import { SessionArchiveBridge } from './features/session/components/SessionArchiveBridge';
import { SessionRefreshBridge } from './features/session/components/SessionRefreshBridge';
import { RowActionsCueBridge } from './app/components/RowActionsCueBridge';
import { SidebarPeekOverlay } from './features/workspace/components/SidebarPeekOverlay';
import { ShellLeft } from './app/components/SideColumn/ShellLeft';
import { useColumnActions } from './app/hooks/useColumnActions';
import { useGoToBoard } from './app/hooks/useGoToBoard';
import { useWindowPresence } from './features/workspace/hooks/useWindowPresence';
import { useViewedOnReturn } from './app/hooks/useViewedOnReturn';
import { useWindowLayout } from './features/workspace/hooks/useWindowLayout';
import { primaryProjectRoot } from './features/workspace/primaryProjectRoot';
import { ReleaseNoticeBridge } from './features/changelog/components/ReleaseNoticeBridge';
import { openRunningScript } from './features/scripts/openRunningScript';
import { listenOrphansSwept } from './features/monitoring/listenOrphansSwept';
import { listenWindowFacts } from './app/listenWindowFacts';
import { listenBridgeCommands } from './features/companion/commandExecutor';
import { listenProjectMaterializeRequests } from './features/session/projectMaterializeBridge';
import { listenMountCommands } from './features/session/mountQueryBridge';
import { startAutoRuntime } from './store/runtime/auto/startAutoRuntime';
import { startWorktreeWriterBridge } from './features/session/resolve/worktreeWriterBridge';
import { startPrWriteBridge } from './features/review/prWriteBridge';
import { useHiddenWindowPause } from './shared/hooks/useHiddenWindowPause';
import { useProviderRefreshOnFocus } from './shared/hooks/useProviderRefreshOnFocus';
import { useProviderLimitsProbe } from './shared/hooks/useProviderLimitsProbe';
import { useBrowserWindowShortcuts } from './features/browser/hooks/useBrowserWindowShortcuts';
import { useKeepFullScreenOnEscape } from './shared/hooks/useKeepFullScreenOnEscape';
import { useTitlebarInset } from './shared/hooks/useTitlebarInset';
import { useUnhandledRejectionNotice } from './shared/hooks/useUnhandledRejectionNotice';
import { useArtifactMirror } from './features/artifacts/hooks/useArtifactMirror';
import { useMonitoringSignalRefresh } from './features/monitoring/hooks/useMonitoringSignalRefresh';
import { useAppStore, useCurrentSession, useCurrentWorkspace } from './store';
import { useGithubPolling } from './features/integrations/github/hooks/useGithubPolling';
import { useRunWatchdog } from './features/workflows/hooks/useRunWatchdog';
import { useSessionFocusRecheck } from './features/session/hooks/useSessionFocusRecheck';
import { useSessionPinsSync } from './features/workspace/hooks/useSessionPinsSync';
import { useUpdaterPolling } from './features/updater/hooks/useUpdaterPolling';
import { useAsyncSubscription } from './app/hooks/useAsyncSubscription';
import { useSessionSidebarVisibility } from './features/workspace/hooks/useSessionSidebarVisibility';
import { shellArrangement } from './app/shellArrangement';
import { DrawerHost } from './app/components/DrawerHost';
import { useShellRight } from './app/hooks/useShellRight';
import { selectIsSessionDraftShown } from './store/slices/sessionDraft/selectIsSessionDraftShown';
import { selectDrawerPlacement } from './store/slices/drawer/selectDrawerPlacement';
import { selectDrawerSizing } from './store/slices/drawer/selectDrawerSizing';
import { ReportSheetHost } from './features/bug-report/components/ReportSheetHost';
import { LastCrashBridge } from './features/bug-report/components/LastCrashBridge';

const KEEP_ALIVE_CAP = 5;

export const App = () => {
  const hydrate = useAppStore((s) => s.hydrate);
  const checkForUpdates = useAppStore((s) => s.checkForUpdates);
  const hydrated = useAppStore((s) => s.hydrated);
  const isShellShown = useAppStore((s) => s.isShellReady && s.bootPhase !== 'error');
  const drawerSizing = useAppStore(selectDrawerSizing);
  const drawerPlacement = useAppStore(selectDrawerPlacement);
  const { rightRail, isDrawerMounted, isDrawerParked } = useShellRight({});
  const [isSplashGone, setIsSplashGone] = useState(false);
  const removeSplash = useCallback(() => setIsSplashGone(true), []);
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id ?? null;
  const workspaceProjectRoot = useAppStore((s) =>
    currentWorkspaceId == null
      ? null
      : primaryProjectRoot({ projects: s.projects, workspaceId: currentWorkspaceId }),
  );
  const currentSession = useCurrentSession();
  const isDraftShown = useAppStore((s) => selectIsSessionDraftShown({ state: s }));
  const sessionSidebar = useSessionSidebarVisibility({ hasSidebar: true });
  const [keepAliveIds, setKeepAliveIds] = useState<ReadonlyArray<SessionId>>([]);
  const isWorkspaceLauncherBranch = currentWorkspace === null;
  const arrangement = shellArrangement({
    hasWorkspace: currentWorkspace != null,
    isSidebarCollapsed: sessionSidebar.isCollapsed,
  });
  const goToBoard = useGoToBoard();
  const {
    armDeleteConfirm,
    openChangelog,
    openChat,
    openGuide,
    openInbox,
    openPalette,
    openSettings,
    openShortcutHelp,
    openSpend,
    openWorkflows,
    openNewChat,
    openMonitoring,
    openImpact,
    settingsProviderId,
    studio,
    layers,
  } = useAppOverlays({
    currentSession,
    currentWorkspace,
    workspaceProjectRoot,
    isWorkspaceLauncherBranch,
  });
  const columnActions = useColumnActions({
    openBoard: goToBoard,
    openInbox,
    openChat,
    openWorkflows,
    openNewChat,
    openMonitoring,
    openImpact,
    openSettings,
    openChangelog,
    openGuide,
  });

  useEffect(() => {
    void hydrate();
    if (import.meta.env.PROD) {
      void checkForUpdates();
    }
  }, [hydrate, checkForUpdates]);

  useGithubPolling();
  useRunWatchdog();
  useSessionFocusRecheck();
  useSessionPinsSync();
  useHiddenWindowPause();
  useProviderRefreshOnFocus();
  useProviderLimitsProbe();
  useUpdaterPolling();
  useWindowPresence();
  useViewedOnReturn();
  useWindowLayout();
  useBrowserWindowShortcuts();
  useArtifactMirror({ isReady: hydrated });
  useMonitoringSignalRefresh({ isReady: hydrated });
  useTitlebarInset();
  useKeepFullScreenOnEscape();
  useUnhandledRejectionNotice();
  useAsyncSubscription({ start: listenBridgeCommands });
  useAsyncSubscription({ start: listenOrphansSwept });
  useAsyncSubscription({ start: listenWindowFacts });
  useAsyncSubscription({ start: listenProjectMaterializeRequests });
  useAsyncSubscription({ start: listenMountCommands });
  useAsyncSubscription({ start: startAutoRuntime });
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
    openNewChat,
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

  const deferredRenderedIds = useDeferredValue(renderedSessionIds);
  const deferredActiveId = useDeferredValue(currentSession?.id ?? null);

  if (!isShellShown) {
    return <AppBootSplash />;
  }

  const splashExit = isSplashGone ? null : <BootSplashExit onDone={removeSplash} />;

  if (isWorkspaceLauncherBranch) {
    return (
      <ToastProvider>
        <UndoToastBridge />
        <AnnouncementRegion />
        <NeedsYouAnnouncementBridge />
        <ObjectMenuProvider>
          <NotificationToastBridge />
          <ReportSheetHost />
          <LastCrashBridge />
          <Fragment key="layers">{layers}</Fragment>
        </ObjectMenuProvider>
        {splashExit}
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <UndoToastBridge />
      <AnnouncementRegion />
      <NeedsYouAnnouncementBridge />
      <ObjectMenuProvider>
        <NotificationToastBridge />
        <AwayAlertsBridge />
        <ReportSheetHost />
        <LastCrashBridge />
        <WorkflowFollowToastBridge />
        <ScriptEndToastBridge />
        <NewSessionBridge />
        <SessionArchiveBridge />
        <SessionRefreshBridge />
        <RowActionsCueBridge />
        <ReleaseNoticeBridge onOpenChangelog={openChangelog} />
        <AppShell
          topBar={
            <AppTopBar
              sidebar={{ isCollapsed: arrangement.isLeftRail, onToggle: sessionSidebar.toggle }}
              onOpenSpend={openSpend}
              onOpenScript={(run) => void openRunningScript({ run })}
              openProviderId={settingsProviderId}
            />
          }
          leftSidebarCollapsed={arrangement.isLeftRail}
          leftSidebar={
            <ShellLeft
              arrangement={arrangement}
              workspaceId={currentWorkspaceId}
              currentSessionId={currentSession?.id ?? null}
              isDraftShown={isDraftShown}
              actions={columnActions}
            />
          }
          leftOverlay={
            arrangement.leftOverlaySlot === 'peek' ? (
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
                <ShellLeft
                  arrangement={arrangement}
                  workspaceId={currentWorkspaceId}
                  currentSessionId={currentSession?.id ?? null}
                  isDraftShown={isDraftShown}
                  actions={columnActions}
                  variant="peek"
                  onNavigate={sessionSidebar.closePeek}
                />
              </SidebarPeekOverlay>
            ) : undefined
          }
          drawer={isDrawerMounted ? <DrawerHost /> : null}
          drawerSizing={drawerSizing}
          drawerPlacement={drawerPlacement}
          isDrawerParked={isDrawerParked}
          rightRail={rightRail}
          main={
            <MainRegion
              workspaceId={currentWorkspace.id}
              currentSession={currentSession}
              isDraftShown={isDraftShown}
              renderedIds={deferredRenderedIds}
              activeId={deferredActiveId}
            />
          }
          studio={studio}
        />
        <Fragment key="layers">{layers}</Fragment>
      </ObjectMenuProvider>
      {splashExit}
    </ToastProvider>
  );
};
