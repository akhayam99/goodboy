import { useMemo, useState, type ReactNode } from 'react';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import { useAppOverlays } from '../../../../hooks/useAppOverlays';
import { useGoToBoard } from '../../../../hooks/useGoToBoard';
import { shellArrangement, type ShellArrangement } from '../../../../shellArrangement';
import { useAppStore, useCurrentSession, useCurrentWorkspace } from '../../../../../store';
import { SCENE_CONNECTED, sceneShellMode } from '../sceneShell';

const noop = () => undefined;

type Params = {
  readonly hasActiveSession: boolean;
  readonly isSidebarCollapsed: boolean;
};

type SceneShell = {
  readonly arrangement: ShellArrangement;
  readonly actions: ColumnActions;
  readonly isStudioOpen: boolean;
  readonly studio: ReactNode;
  readonly layers: ReactNode;
  readonly settingsSlot: HTMLDivElement | null;
  readonly settingsSlotRef: (node: HTMLDivElement | null) => void;
};

export const useSceneShell = ({ hasActiveSession, isSidebarCollapsed }: Params): SceneShell => {
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const isStudioOpen = useAppStore((state) => state.appStudio !== null);
  const goToBoard = useGoToBoard();
  const [settingsSlot, setSettingsSlot] = useState<HTMLDivElement | null>(null);
  const arrangement = shellArrangement({
    hasWorkspace: true,
    hasActiveSession,
    isSidebarCollapsed,
    mode: sceneShellMode(),
  });
  const overlays = useAppOverlays({
    connected: SCENE_CONNECTED,
    currentSession,
    currentWorkspace,
    workspaceProjectRoot: null,
    isSessionSidebarCollapsed: isSidebarCollapsed,
    isWorkspaceLauncherBranch: false,
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
      openSettings: overlays.openSettings,
      openChangelog: overlays.openChangelog,
      openShortcuts: overlays.openShortcutHelp,
    }),
    [goToBoard, overlays],
  );
  return {
    arrangement,
    actions,
    isStudioOpen,
    studio: overlays.studio,
    layers: overlays.layers,
    settingsSlot,
    settingsSlotRef: setSettingsSlot,
  };
};
