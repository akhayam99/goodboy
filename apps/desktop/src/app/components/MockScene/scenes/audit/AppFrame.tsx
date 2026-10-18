import { useEffect, useMemo, useState } from 'react';
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

const noop = () => undefined;

type Props = {
  readonly view: string;
  readonly isRailCollapsed: boolean;
  readonly hasPane?: boolean;
  readonly hasLiveToggle?: boolean;
};

export const AppFrame = ({
  view,
  isRailCollapsed,
  hasPane = false,
  hasLiveToggle = false,
}: Props) => {
  const [isFoldPicked, setIsFoldPicked] = useState(isRailCollapsed);
  const isMainCollapsed = hasLiveToggle ? isFoldPicked : isRailCollapsed;
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const drawerSizing = useAppStore(selectDrawerSizing);
  const drawerPlacement = useAppStore(selectDrawerPlacement);
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const sessions = useSessions();
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
    currentSession !== null ? (
      <SessionFrame session={currentSession}>
        <KeepAliveWorkSurface sessionId={currentSession.id} isActive />
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
              onToggle: hasLiveToggle ? () => setIsFoldPicked((isPicked) => !isPicked) : noop,
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
            currentSessionId={currentSession?.id ?? null}
            isDraftShown={false}
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
