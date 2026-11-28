import { useMemo, type ReactNode } from 'react';
import type { ColumnActions } from '../../../ShellLeft/columnDoors';
import { useAppOverlays } from '../../../../hooks/useAppOverlays';
import { useGoToBoard } from '../../../../hooks/useGoToBoard';
import { openHome } from '../../../../../shared/navigation/openHome';
import { useAppStore, useCurrentSession, useCurrentWorkspace } from '../../../../../store';
import { useSceneShortcuts } from '../useSceneShortcuts';
import { openDestination } from '../../../../../shared/navigation/openDestination';

type Params = Record<never, never>;

type SceneShell = {
  readonly actions: ColumnActions;
  readonly isStudioOpen: boolean;
  readonly studio: ReactNode;
  readonly layers: ReactNode;
};

export const useSceneShell = ({}: Params): SceneShell => {
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const isStudioOpen = useAppStore((state) => state.appStudio !== null);
  const goToBoard = useGoToBoard();
  const overlays = useAppOverlays({
    currentSession,
    currentWorkspace,
    workspaceProjectRoot: null,
    isWorkspaceLauncherBranch: false,
  });
  useSceneShortcuts({ openPalette: overlays.openPalette });
  const actions = useMemo<ColumnActions>(
    () => ({
      openHome,
      openBoard: goToBoard,
      openInbox: overlays.openInbox,
      openChat: overlays.openChat,
      openWorkflows: overlays.openWorkflows,
      openNewChat: overlays.openNewChat,
      openConnections: overlays.openConnections,
      openCalendar: () => openDestination({ id: 'calendar' }),
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
