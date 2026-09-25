import { useEffect } from 'react';
import { AppShell } from '@goodboy/ui';
import { AppFooter } from '../../../AppFooter';
import { AppTopBar } from '../../../AppTopBar';
import { NoWorkspaceScreen } from '../../../AppEmptyState';
import { KeepAliveWorkSurface } from '../../../KeepAliveWorkSurface';
import { useAppOverlays } from '../../../../hooks/useAppOverlays';
import { shellArrangement } from '../../../../shellArrangement';
import { StageBoard } from '../../../../../features/workspace/components/StageBoard';
import { SessionNavSidebar } from '../../../../../features/session/components/SessionNavSidebar';
import { CollapsedRail } from '../../../../../features/session/components/SessionNavSidebar/parts/CollapsedRail';
import { useCurrentSession, useCurrentWorkspace, useSessions } from '../../../../../store';
import { FRAME_CONNECTED } from './frameSeed';
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
  const isLauncher = view === 'launcher';
  const overlays = useAppOverlays({
    connected: FRAME_CONNECTED,
    currentSession,
    currentWorkspace,
    workspaceProjectRoot: '/mock/root',
    isSessionSidebarCollapsed: isRailCollapsed,
    isWorkspaceLauncherBranch: isLauncher,
    pinSessionSidebar: noop,
  });

  useEffect(() => {
    const id = window.setTimeout(() => triggerFrameView({ view, openers: overlays }), 30);
    return () => window.clearTimeout(id);
  }, []);

  if (isLauncher) {
    return <>{overlays.layers}</>;
  }

  const arrangement = shellArrangement({
    hasWorkspace: currentWorkspace !== null,
    hasActiveSession: currentSession !== null,
    isSidebarCollapsed: isRailCollapsed,
  });

  const leftSidebar =
    currentSession === null ||
    arrangement.leftSlot === 'none' ? undefined : arrangement.leftSlot === 'rail' ? (
      <CollapsedRail />
    ) : (
      <SessionNavSidebar session={currentSession} />
    );

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
        topBar={
          <AppTopBar
            sidebar={{
              hasSidebar: arrangement.leftSlot !== 'none',
              isCollapsed: arrangement.leftSlot === 'rail',
              onToggle: noop,
            }}
            onOpenSpend={overlays.openSpend}
            onOpenScript={noop}
          />
        }
        footer={
          <AppFooter
            scope={arrangement.footer}
            target={overlays.footer}
            connected={FRAME_CONNECTED}
            onOpenIntegration={overlays.openIntegration}
            onOpenInbox={overlays.openInbox}
            onOpenWorkflows={overlays.openWorkflows}
            onOpenProviders={overlays.openProviders}
            onOpenSettings={overlays.openSettings}
            onOpenImpact={overlays.openImpact}
            onOpenChangelog={overlays.openChangelog}
          />
        }
        leftHidden={arrangement.leftHidden}
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={leftSidebar}
        main={<div className="relative h-full w-full">{main}</div>}
        studio={overlays.studio}
      />
      {overlays.layers}
    </>
  );
};
