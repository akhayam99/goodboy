import { useMemo, useState, type ReactNode } from 'react';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import { useAppOverlays } from '../../../../hooks/useAppOverlays';
import { useGoToBoard } from '../../../../hooks/useGoToBoard';
import type { ShellArrangement } from '../../../../shellArrangement';
import { useAppStore, useCurrentSession, useCurrentWorkspace } from '../../../../../store';
import { useSceneShortcuts } from '../useSceneShortcuts';

const noop = () => undefined;

type Params = {
  readonly arrangement: ShellArrangement;
  readonly onToggleSidebar?: () => void;
};

type SceneShell = {
  readonly actions: ColumnActions;
  readonly isStudioOpen: boolean;
  readonly studio: ReactNode;
  readonly layers: ReactNode;
  readonly settingsSlot: HTMLDivElement | null;
  readonly settingsSlotRef: (node: HTMLDivElement | null) => void;
};

export const useSceneShell = ({ arrangement, onToggleSidebar }: Params): SceneShell => {
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const isStudioOpen = useAppStore((state) => state.appStudio !== null);
  const goToBoard = useGoToBoard();
  const [settingsSlot, setSettingsSlot] = useState<HTMLDivElement | null>(null);
  const overlays = useAppOverlays({
    currentSession,
    currentWorkspace,
    workspaceProjectRoot: null,
    isSessionSidebarCollapsed: arrangement.leftSidebarCollapsed,
    isWorkspaceLauncherBranch: false,
    pinSessionSidebar: noop,
    studioPlacement: arrangement.studioCoversLeft ? 'cover' : 'content',
    settingsColumnSlot: arrangement.leftSlot === 'column' ? settingsSlot : null,
  });
  useSceneShortcuts({
    openPalette: overlays.openPalette,
    ...(onToggleSidebar === undefined ? {} : { onToggleSidebar }),
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
  return {
    actions,
    isStudioOpen,
    studio: overlays.studio,
    layers: overlays.layers,
    settingsSlot,
    settingsSlotRef: setSettingsSlot,
  };
};
