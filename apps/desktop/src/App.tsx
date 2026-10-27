import { UndoToastBridge } from './app/components/UndoToastBridge';
import { AnnouncementRegion } from './app/components/AnnouncementRegion';
import { NeedsYouAnnouncementBridge } from './app/components/NeedsYouAnnouncementBridge';
import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { BootSplash } from './app/components/BootSplash';
import { BootSplashExit } from './app/components/BootSplash/BootSplashExit';
import { KeepAliveWorkSurface } from './app/components/KeepAliveWorkSurface';
import { AppTopBar } from './app/components/AppTopBar';
import { useAppShortcuts } from './app/hooks/useAppShortcuts';
import { useAppOverlays } from './app/hooks/useAppOverlays';
import { StageBoard } from './features/workspace/components/StageBoard';
import { ToastProvider } from './shared/components/Toast';
import { ObjectMenuProvider } from './features/actions/components/ObjectMenuProvider';
import { NotificationToastBridge } from './features/notifications/components/NotificationToastBridge';
import { AwayAlertsBridge } from './features/notifications/components/AwayAlertsBridge';
import { WorkflowFollowToastBridge } from './features/workflows/components/WorkflowFollowToastBridge';
import { ScriptEndToastBridge } from './features/scripts/components/ScriptEndToastBridge';
import { NewSessionBridge } from './features/session/components/NewSessionBridge';
import { SessionDraftPane } from './features/session/components/SessionDraftPane';
import { SessionArchiveBridge } from './features/session/components/SessionArchiveBridge';
import { SessionRefreshBridge } from './features/session/components/SessionRefreshBridge';
import { RowActionsCueBridge } from './app/components/RowActionsCueBridge';
import { SidebarPeekOverlay } from './features/workspace/components/SidebarPeekOverlay';
import { ShellLeft } from './app/components/SideColumn/ShellLeft';
import { SessionFrame } from './app/components/SessionRail/SessionFrame';
import type { ColumnActions } from './app/components/SideColumn/columnDoors';
import { useGoToBoard } from './app/hooks/useGoToBoard';
import { useWindowPresence } from './features/workspace/hooks/useWindowPresence';
import { useViewedOnReturn } from './app/hooks/useViewedOnReturn';
import { useWindowLayout } from './features/workspace/hooks/useWindowLayout';
import { primaryProjectRoot } from './features/workspace/primaryProjectRoot';
import { ReleaseNoticeBridge } from './features/changelog/components/ReleaseNoticeBridge';
import { openRunningScript } from './features/scripts/openRunningScript';
import { listenOrphansSwept } from './features/monitoring/listenOrphansSwept';
import { listenSettingChanges } from './features/settings/listenSettingChanges';
import { listenBridgeCommands } from './features/companion/commandExecutor';
import { listenProjectMaterializeRequests } from './features/session/projectMaterializeBridge';
import { listenMountCommands } from './features/session/mountQueryBridge';
import { startAutoRuntime } from './store/runtime/auto/startAutoRuntime';
import { startWorktreeWriterBridge } from './features/session/resolve/worktreeWriterBridge';
import { startPrWriteBridge } from './features/review/prWriteBridge';
import { useHiddenWindowPause } from './shared/hooks/useHiddenWindowPause';
import { useProviderRefreshOnFocus } from './shared/hooks/useProviderRefreshOnFocus';
import { useProviderLimitsProbe } from './shared/hooks/useProviderLimitsProbe';
import { useWindowShortcuts } from './shared/hooks/useWindowShortcuts';
import { useKeepFullScreenOnEscape } from './shared/hooks/useKeepFullScreenOnEscape';
import { useTitlebarInset } from './shared/hooks/useTitlebarInset';
import { useUnhandledRejectionNotice } from './shared/hooks/useUnhandledRejectionNotice';
import { useArtifactMirror } from './features/artifacts/hooks/useArtifactMirror';
import { useMonitoringSignalRefresh } from './features/monitoring/hooks/useMonitoringSignalRefresh';
import { useAppStore, useCurrentSession, useCurrentWorkspace, useSessions } from './store';
import { useGithubPolling } from './features/integrations/github/hooks/useGithubPolling';
import { useRunWatchdog } from './features/workflows/hooks/useRunWatchdog';
import { useSessionFocusRecheck } from './features/session/hooks/useSessionFocusRecheck';
import { useSessionPinsSync } from './features/workspace/hooks/useSessionPinsSync';
import { useUpdaterPolling } from './features/updater/hooks/useUpdaterPolling';
import { useAsyncSubscription } from './app/hooks/useAsyncSubscription';
import { useSessionSidebarVisibility } from './features/workspace/hooks/useSessionSidebarVisibility';
import { shellArrangement } from './app/shellArrangement';
import { DrawerHost } from './app/components/DrawerHost';
import { selectIsSessionDraftShown } from './store/slices/sessionDraft/selectIsSessionDraftShown';
import { selectDrawerPanel } from './store/slices/drawer/selectDrawerPanel';
import { selectDrawerPlacement } from './store/slices/drawer/selectDrawerPlacement';
import { selectDrawerSizing } from './store/slices/drawer/selectDrawerSizing';
import { ReportSheetHost } from './features/bug-report/components/ReportSheetHost';
import { LastCrashBridge } from './features/bug-report/components/LastCrashBridge';

const KEEP_ALIVE_CAP = 5;

export const App = () => {
  const hydrate = useAppStore((s) => s.hydrate);
  const retryHydrate = useAppStore((s) => s.retryHydrate);
  const checkForUpdates = useAppStore((s) => s.checkForUpdates);
  const hydrated = useAppStore((s) => s.hydrated);
  const isDrawerOpen = useAppStore((s) => selectDrawerPanel(s) !== null);
  const drawerSizing = useAppStore(selectDrawerSizing);
  const drawerPlacement = useAppStore(selectDrawerPlacement);
  const bootPhase = useAppStore((s) => s.bootPhase);
  const bootFailedPhase = useAppStore((s) => s.bootFailedPhase);
  const error = useAppStore((s) => s.error);
  const newerDatabase = useAppStore((s) => s.newerDatabase);
  const restoreNewerDatabaseBackup = useAppStore((s) => s.restoreNewerDatabaseBackup);
  const quitApp = useAppStore((s) => s.quitApp);
  const [splashStage, setSplashStage] = useState<'running' | 'leaving' | 'gone'>('running');
  const finishSplash = useCallback(() => setSplashStage('leaving'), []);
  const removeSplash = useCallback(() => setSplashStage('gone'), []);
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id ?? null;
  const workspaceProjectRoot = useAppStore((s) =>
    currentWorkspaceId == null
      ? null
      : primaryProjectRoot({ projects: s.projects, workspaceId: currentWorkspaceId }),
  );
  const currentSession = useCurrentSession();
  const currentWorkspaceSessions = useSessions();
  const isDraftShown = useAppStore((s) => selectIsSessionDraftShown({ state: s }));
  const isSettingsOpen = useAppStore((s) => s.appStudio?.kind === 'settings');
  const sessionSidebar = useSessionSidebarVisibility({ hasSidebar: true });
  const [settingsColumnSlot, setSettingsColumnSlot] = useState<HTMLDivElement | null>(null);
  const [keepAliveIds, setKeepAliveIds] = useState<ReadonlyArray<SessionId>>([]);
  const isWorkspaceLauncherBranch = currentWorkspace === null;
  const arrangement = shellArrangement({
    hasWorkspace: currentWorkspace != null,
    isSidebarCollapsed: sessionSidebar.isCollapsed,
    isSettingsOpen,
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
    openTerminalStudio,
    openNewChat,
    openNewTerminal,
    openMonitoring,
    openImpact,
    settingsProviderId,
    studio,
    layers,
  } = useAppOverlays({
    currentSession,
    currentWorkspace,
    workspaceProjectRoot,
    isSessionSidebarCollapsed: sessionSidebar.isCollapsed,
    isWorkspaceLauncherBranch,
    pinSessionSidebar: sessionSidebar.pin,
    studioPlacement: arrangement.studioCoversLeft ? 'cover' : 'content',
    settingsColumnSlot: arrangement.leftSlot === 'column' ? settingsColumnSlot : null,
  });
  const columnActions = useMemo<ColumnActions>(
    () => ({
      openBoard: goToBoard,
      openInbox,
      openChat,
      openWorkflows,
      openTerminalStudio,
      openNewChat,
      openNewTerminal,
      openMonitoring,
      openImpact,
      openSettings,
      openChangelog,
      openGuide,
      openShortcuts: openShortcutHelp,
    }),
    [
      goToBoard,
      openInbox,
      openChat,
      openWorkflows,
      openTerminalStudio,
      openNewChat,
      openNewTerminal,
      openMonitoring,
      openImpact,
      openSettings,
      openChangelog,
      openGuide,
      openShortcutHelp,
    ],
  );

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
  useWindowShortcuts();
  useArtifactMirror({ isReady: hydrated });
  useMonitoringSignalRefresh({ isReady: hydrated });
  useTitlebarInset();
  useKeepFullScreenOnEscape();
  useUnhandledRejectionNotice();
  useAsyncSubscription({ start: listenBridgeCommands });
  useAsyncSubscription({ start: listenOrphansSwept });
  useAsyncSubscription({ start: listenSettingChanges });
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
    openTerminalStudio,
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

  if (!hydrated || splashStage === 'running') {
    return (
      <BootSplash
        phase={bootPhase}
        failedPhase={bootFailedPhase}
        error={error}
        newerDatabase={newerDatabase}
        onRetry={retryHydrate}
        onRestoreBackup={restoreNewerDatabaseBackup}
        onQuit={() => void quitApp()}
        onFinished={finishSplash}
      />
    );
  }

  const splashExit = splashStage === 'leaving' ? <BootSplashExit onDone={removeSplash} /> : null;

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
              sidebar={{ isCollapsed: sessionSidebar.isCollapsed, onToggle: sessionSidebar.toggle }}
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
              settingsSlotRef={setSettingsColumnSlot}
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
          studioCoversLeft={arrangement.studioCoversLeft}
          drawer={isDrawerOpen ? <DrawerHost /> : null}
          drawerSizing={drawerSizing}
          drawerPlacement={drawerPlacement}
          main={
            <div className="relative h-full w-full">
              {currentSession ? (
                <SessionFrame session={currentSession}>
                  {deferredRenderedIds.map((id) => (
                    <KeepAliveWorkSurface
                      key={id}
                      sessionId={id}
                      isActive={id === deferredActiveId}
                    />
                  ))}
                </SessionFrame>
              ) : isDraftShown ? (
                <SessionDraftPane workspaceId={currentWorkspace.id} />
              ) : (
                <StageBoard workspaceId={currentWorkspace.id} sessions={currentWorkspaceSessions} />
              )}
            </div>
          }
          studio={studio}
        />
        <Fragment key="layers">{layers}</Fragment>
      </ObjectMenuProvider>
      {splashExit}
    </ToastProvider>
  );
};
