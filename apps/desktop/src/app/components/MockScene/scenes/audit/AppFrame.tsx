import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AppFooter } from '../../../AppFooter';
import { AppTopBar } from '../../../AppTopBar';
import { NoWorkspaceScreen } from '../../../AppEmptyState';
import { KeepAliveWorkSurface } from '../../../KeepAliveWorkSurface';
import { ShellLeft } from '../../../SideColumn/ShellLeft';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import { useAppOverlays } from '../../../../hooks/useAppOverlays';
import { useGoToBoard } from '../../../../hooks/useGoToBoard';
import { shellArrangement, type ShellMode } from '../../../../shellArrangement';
import { StageBoard } from '../../../../../features/workspace/components/StageBoard';
import {
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessions,
} from '../../../../../store';
import { sceneShellMode } from '../sceneShell';
import { FRAME_CONNECTED } from './frameSeed';
import { triggerFrameView } from './frameViews';

const noop = () => undefined;

type Props = {
  readonly view: string;
  readonly isRailCollapsed: boolean;
  readonly mode?: ShellMode;
};

export const AppFrame = ({ view, isRailCollapsed, mode = sceneShellMode() }: Props) => {
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const sessions = useSessions();
  const goToBoard = useGoToBoard();
  const [settingsSlot, setSettingsSlot] = useState<HTMLDivElement | null>(null);
  const isSettingsOpen = useAppStore((state) => state.appStudio?.kind === 'settings');
  const isLauncher = view === 'launcher';
  const arrangement = shellArrangement({
    hasWorkspace: currentWorkspace !== null,
    hasActiveSession: currentSession !== null,
    isSidebarCollapsed: isRailCollapsed,
    mode,
    isSettingsOpen,
  });
  const overlays = useAppOverlays({
    connected: FRAME_CONNECTED,
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
      <StageBoard
        workspaceId={currentWorkspace.id}
        sessions={sessions}
        hasNewSession={arrangement.mode === 'classic'}
      />
    ) : (
      <NoWorkspaceScreen onAddWorkspace={overlays.openAddWorkspace} />
    );

  return (
    <>
      <AppShell
        topBar={
          <AppTopBar mode={arrangement.mode} onOpenSpend={overlays.openSpend} onOpenScript={noop} />
        }
        footer={
          arrangement.footer === null ? undefined : (
            <AppFooter
              scope={arrangement.footer}
              target={overlays.footer}
              connected={FRAME_CONNECTED}
              onOpenIntegration={overlays.openIntegration}
              onOpenInbox={overlays.openInbox}
              onOpenWorkflows={overlays.openWorkflows}
              onOpenImpact={overlays.openImpact}
              onOpenSettings={overlays.openSettings}
              onOpenShortcuts={overlays.openShortcutHelp}
              onOpenChangelog={overlays.openChangelog}
              onOpenGuide={overlays.openGuide}
            />
          )
        }
        leftHidden={arrangement.leftHidden}
        leftSidebarCollapsed={arrangement.isLeftRail}
        leftSidebar={
          arrangement.leftSlot === 'none' ? undefined : (
            <ShellLeft
              arrangement={arrangement}
              workspaceId={currentWorkspace?.id ?? null}
              currentSessionId={currentSession?.id ?? null}
              isDraftShown={false}
              actions={actions}
              onToggle={noop}
              settingsSlotRef={setSettingsSlot}
            />
          )
        }
        main={<div className="relative h-full w-full">{main}</div>}
        studio={overlays.studio}
        studioCoversLeft={arrangement.studioCoversLeft}
      />
      {overlays.layers}
    </>
  );
};
