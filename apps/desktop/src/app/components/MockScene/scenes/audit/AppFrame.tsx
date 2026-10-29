import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import { AppTopBar } from '../../../AppTopBar';
import { KeepAliveWorkSurface } from '../../../KeepAliveWorkSurface';
import { ShellLeft } from '../../../SideColumn/ShellLeft';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import { useAppOverlays } from '../../../../hooks/useAppOverlays';
import { useGoToBoard } from '../../../../hooks/useGoToBoard';
import { shellArrangement } from '../../../../shellArrangement';
import { StageBoard } from '../../../../../features/workspace/components/StageBoard';
import { SessionDraftPane } from '../../../../../features/session/components/SessionDraftPane';
import {
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessions,
} from '../../../../../store';
import { DrawerHost } from '../../../DrawerHost';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerPlacement } from '../../../../../store/slices/drawer/selectDrawerPlacement';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { triggerFrameView } from './frameViews';
import { useSceneShortcuts } from '../useSceneShortcuts';
import { isDirectedScene } from '../../../../../shared/utils/isDirectedScene';

const noop = () => undefined;

type Props = {
  readonly view: string;
  readonly isRailCollapsed: boolean;
  readonly hasPane?: boolean;
  readonly hasLiveToggle?: boolean;
  readonly hasDraft?: boolean;
  readonly center?: ReactNode;
};

export const AppFrame = ({
  view,
  isRailCollapsed,
  hasPane = false,
  hasLiveToggle = false,
  hasDraft = false,
  center,
}: Props) => {
  const [isFoldPicked, setIsFoldPicked] = useState(isRailCollapsed);
  const isFoldLive = hasLiveToggle || isDirectedScene();
  const isMainCollapsed = isFoldLive ? isFoldPicked : isRailCollapsed;
  const toggleFold = () => setIsFoldPicked((isPicked) => !isPicked);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const drawerSizing = useAppStore(selectDrawerSizing);
  const drawerPlacement = useAppStore(selectDrawerPlacement);
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const sessions = useSessions();
  const draftWorkspaceId = useAppStore((state) => state.openSessionDraftWorkspaceId);
  const isDraftShown =
    hasDraft && draftWorkspaceId !== null && draftWorkspaceId === currentWorkspace?.id;
  const goToBoard = useGoToBoard();
  const [settingsSlot, setSettingsSlot] = useState<HTMLDivElement | null>(null);
  const isSettingsOpen = useAppStore((state) => state.appStudio?.kind === 'settings');
  const isLauncher = view === 'launcher' || currentWorkspace === null;
  const arrangement = shellArrangement({
    hasWorkspace: currentWorkspace !== null,
    isSidebarCollapsed: isMainCollapsed,
    isSettingsOpen,
  });
  const overlays = useAppOverlays({
    currentSession,
    currentWorkspace,
    workspaceProjectRoot: '/mock/root',
    isSessionSidebarCollapsed: isRailCollapsed,
    isWorkspaceLauncherBranch: isLauncher,
    pinSessionSidebar: noop,
    studioPlacement: arrangement.studioCoversLeft ? 'cover' : 'content',
    settingsColumnSlot: arrangement.leftSlot === 'column' ? settingsSlot : null,
  });
  useSceneShortcuts({
    openPalette: overlays.openPalette,
    ...(isFoldLive ? { onToggleSidebar: toggleFold } : {}),
  });
  const actions = useMemo<ColumnActions>(
    () => ({
      openBoard: goToBoard,
      openInbox: overlays.openInbox,
      openChat: overlays.openChat,
      openWorkflows: overlays.openWorkflows,
      openTerminalStudio: overlays.openTerminalStudio,
      openNewChat: overlays.openNewChat,
      openNewTerminal: overlays.openNewTerminal,
      openMonitoring: overlays.openMonitoring,
      openImpact: overlays.openImpact,
      openSettings: overlays.openSettings,
      openChangelog: overlays.openChangelog,
      openGuide: overlays.openGuide,
      openShortcuts: overlays.openShortcutHelp,
    }),
    [goToBoard, overlays],
  );

  useEffect(() => {
    const id = window.setTimeout(() => triggerFrameView({ view, openers: overlays }), 30);
    return () => window.clearTimeout(id);
  }, []);

  if (isLauncher) {
    return <>{overlays.layers}</>;
  }

  const main =
    isDraftShown && draftWorkspaceId !== null ? (
      <SessionDraftPane workspaceId={draftWorkspaceId} />
    ) : currentSession !== null ? (
      <SessionFrame session={currentSession}>
        {center ?? <KeepAliveWorkSurface sessionId={currentSession.id} isActive />}
      </SessionFrame>
    ) : currentWorkspace !== null ? (
      <StageBoard workspaceId={currentWorkspace.id} sessions={sessions} />
    ) : null;

  return (
    <>
      <AppShell
        topBar={
          <AppTopBar
            sidebar={{
              isCollapsed: isMainCollapsed,
              onToggle: isFoldLive ? toggleFold : noop,
            }}
            onOpenSpend={overlays.openSpend}
            onOpenScript={noop}
          />
        }
        leftSidebarCollapsed={arrangement.isLeftRail}
        leftSidebar={
          <ShellLeft
            arrangement={arrangement}
            workspaceId={currentWorkspace?.id ?? null}
            currentSessionId={isDraftShown ? null : (currentSession?.id ?? null)}
            isDraftShown={isDraftShown}
            actions={actions}
            settingsSlotRef={setSettingsSlot}
          />
        }
        main={<div className="relative h-full w-full">{main}</div>}
        studio={overlays.studio}
        studioCoversLeft={arrangement.studioCoversLeft}
        {...(hasPane && {
          drawer: isDrawerOpen ? <DrawerHost /> : null,
          drawerSizing,
          drawerPlacement,
        })}
      />
      {overlays.layers}
    </>
  );
};
