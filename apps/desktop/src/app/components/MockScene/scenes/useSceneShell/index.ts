import { useMemo, type ReactNode } from 'react';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import { useAppOverlays } from '../../../../hooks/useAppOverlays';
import { useGoToBoard } from '../../../../hooks/useGoToBoard';
import type { ShellArrangement } from '../../../../shellArrangement';
import { useAppStore, useCurrentSession, useCurrentWorkspace } from '../../../../../store';
import { useSceneShortcuts } from '../useSceneShortcuts';

type Params = {
  readonly arrangement: ShellArrangement;
  readonly onToggleSidebar?: () => void;
};

type SceneShell = {
  readonly actions: ColumnActions;
  readonly isStudioOpen: boolean;
  readonly studio: ReactNode;
  readonly layers: ReactNode;
};

export const useSceneShell = ({ arrangement, onToggleSidebar }: Params): SceneShell => {
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const isStudioOpen = useAppStore((state) => state.appStudio !== null);
  const goToBoard = useGoToBoard();
  const overlays = useAppOverlays({
    currentSession,
    currentWorkspace,
    workspaceProjectRoot: null,
    isWorkspaceLauncherBranch: false,
    studioPlacement: arrangement.studioCoversLeft ? 'cover' : 'content',
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
      openBrowserStudio: overlays.openBrowserStudio,
      openNewChat: overlays.openNewChat,
      openMonitoring: overlays.openMonitoring,
      openImpact: overlays.openImpact,
      openSettings: overlays.openSettings,
      openChangelog: overlays.openChangelog,
      openGuide: overlays.openGuide,
    }),
    [goToBoard, overlays],
  );
  return {
    actions,
    isStudioOpen,
    studio: overlays.studio,
    layers: overlays.layers,
  };
};
