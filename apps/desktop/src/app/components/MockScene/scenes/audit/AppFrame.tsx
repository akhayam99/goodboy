import { useEffect, useMemo, type ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import { AppTopBar } from '../../../AppTopBar';
import { KeepAliveWorkSurface } from '../../../KeepAliveWorkSurface';
import { ShellLeft } from '../../../ShellLeft';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import type { ColumnActions } from '../../../ShellLeft/columnDoors';
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
import { useShellRight } from '../../../../hooks/useShellRight';
import { selectDrawerPlacement } from '../../../../../store/slices/drawer/selectDrawerPlacement';
import { triggerFrameView } from './frameViews';
import { useSceneShortcuts } from '../useSceneShortcuts';

const noop = () => undefined;

type Props = {
  readonly view: string;
  readonly hasPane?: boolean;
  readonly hasDraft?: boolean;
  readonly center?: ReactNode;
};

export const AppFrame = ({ view, hasPane = false, hasDraft = false, center }: Props) => {
  const shellRight = useShellRight({});
  const drawerPlacement = useAppStore(selectDrawerPlacement);
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const sessions = useSessions();
  const draftWorkspaceId = useAppStore((state) => state.openSessionDraftWorkspaceId);
  const isDraftShown =
    hasDraft && draftWorkspaceId !== null && draftWorkspaceId === currentWorkspace?.id;
  const goToBoard = useGoToBoard();
  const isLauncher = view === 'launcher' || currentWorkspace === null;
  const arrangement = shellArrangement({ hasWorkspace: currentWorkspace !== null });
  const overlays = useAppOverlays({
    currentSession,
    currentWorkspace,
    workspaceProjectRoot: '/mock/root',
    isWorkspaceLauncherBranch: isLauncher,
  });
  useSceneShortcuts({ openPalette: overlays.openPalette });
  const actions = useMemo<ColumnActions>(
    () => ({
      openBoard: goToBoard,
      openInbox: overlays.openInbox,
      openChat: overlays.openChat,
      openWorkflows: overlays.openWorkflows,
      openNewChat: overlays.openNewChat,
      openConnections: overlays.openConnections,
      openMonitoring: overlays.openMonitoring,
      openImpact: overlays.openImpact,
      openSettings: overlays.openSettings,
      openChangelog: overlays.openChangelog,
      openGuide: overlays.openGuide,
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
        topBar={<AppTopBar onOpenSpend={overlays.openSpend} onOpenScript={noop} />}
        leftRail={
          <ShellLeft
            arrangement={arrangement}
            workspaceId={currentWorkspace?.id ?? null}
            actions={actions}
          />
        }
        main={<div className="relative h-full w-full">{main}</div>}
        studio={overlays.studio}
        rightRail={shellRight.rightRail}
        {...(hasPane && {
          drawer: shellRight.isDrawerMounted ? <DrawerHost slot="dock" /> : null,
          detail: shellRight.isDetailMounted ? <DrawerHost slot="detail" /> : null,
          isDrawerParked: shellRight.isDrawerParked,
          isDetailParked: shellRight.isDetailParked,
          isDockInStudio: shellRight.isDockInStudio,
          drawerSizing: shellRight.dockSizing,
          dockGrid: shellRight.dockGrid,
          detailSizing: shellRight.detailSizing,
          drawerPlacement,
        })}
      />
      {overlays.layers}
    </>
  );
};
