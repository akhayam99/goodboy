import { useMemo, useState, type ReactNode } from 'react';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import { useAppOverlays } from '../../../../hooks/useAppOverlays';
import { useGoToBoard } from '../../../../hooks/useGoToBoard';
import type { ShellArrangement } from '../../../../shellArrangement';
import { useAppStore, useCurrentSession, useCurrentWorkspace } from '../../../../../store';
import { SCENE_CONNECTED } from '../sceneShell';

const noop = () => undefined;

type Params = {
  readonly arrangement: ShellArrangement;
};

type SceneShell = {
  readonly actions: ColumnActions;
  readonly isStudioOpen: boolean;
  readonly studio: ReactNode;
  readonly layers: ReactNode;
  readonly settingsSlot: HTMLDivElement | null;
  readonly settingsSlotRef: (node: HTMLDivElement | null) => void;
};

export const useSceneShell = ({ arrangement }: Params): SceneShell => {
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const isStudioOpen = useAppStore((state) => state.appStudio !== null);
  const goToBoard = useGoToBoard();
  const [settingsSlot, setSettingsSlot] = useState<HTMLDivElement | null>(null);
  const overlays = useAppOverlays({
    connected: SCENE_CONNECTED,
    currentSession,
    currentWorkspace,
    workspaceProjectRoot: null,
    isSessionSidebarCollapsed: arrangement.leftSidebarCollapsed,
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
    actions,
    isStudioOpen,
    studio: overlays.studio,
    layers: overlays.layers,
    settingsSlot,
    settingsSlotRef: setSettingsSlot,
  };
};
