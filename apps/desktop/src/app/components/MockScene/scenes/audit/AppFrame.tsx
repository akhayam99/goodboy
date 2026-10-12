import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AppTopBar } from '../../../AppTopBar';
import { NoWorkspaceScreen } from '../../../AppEmptyState';
import { KeepAliveWorkSurface } from '../../../KeepAliveWorkSurface';
import { ShellLeft } from '../../../SideColumn/ShellLeft';
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
import { triggerFrameView } from './frameViews';

const noop = () => undefined;

type Props = {
  readonly view: string;
  readonly isRailCollapsed: boolean;
};

export const AppFrame = ({ view, isRailCollapsed }: Props) => {
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const sessions = useSessions();
  const goToBoard = useGoToBoard();
  const [settingsSlot, setSettingsSlot] = useState<HTMLDivElement | null>(null);
  const isSettingsOpen = useAppStore((state) => state.appStudio?.kind === 'settings');
  const isLauncher = view === 'launcher';
  const arrangement = shellArrangement({
    hasWorkspace: currentWorkspace !== null,
    isSidebarCollapsed: isRailCollapsed,
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
      <KeepAliveWorkSurface sessionId={currentSession.id} isActive />
    ) : currentWorkspace !== null ? (
      <StageBoard workspaceId={currentWorkspace.id} sessions={sessions} />
    ) : (
      <NoWorkspaceScreen onAddWorkspace={overlays.openAddWorkspace} />
    );

  return (
    <>
      <AppShell
        topBar={<AppTopBar onOpenSpend={overlays.openSpend} onOpenScript={noop} />}
        leftSidebarCollapsed={arrangement.isLeftRail}
        leftSidebar={
          <ShellLeft
            arrangement={arrangement}
            workspaceId={currentWorkspace?.id ?? null}
            currentSessionId={currentSession?.id ?? null}
            isDraftShown={false}
            actions={actions}
            onToggle={noop}
            settingsSlotRef={setSettingsSlot}
          />
        }
        main={<div className="relative h-full w-full">{main}</div>}
        studio={overlays.studio}
        studioCoversLeft={arrangement.studioCoversLeft}
      />
      {overlays.layers}
    </>
  );
};
