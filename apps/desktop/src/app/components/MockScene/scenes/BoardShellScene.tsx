import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AppTopBar } from '../../AppTopBar';
import { ShellLeft } from '../../SideColumn/ShellLeft';
import { ToastProvider } from '../../../../shared/components/Toast';
import { StageBoard } from '../../../../features/workspace/components/StageBoard';
import { useAppStore, useCurrentSession, useSessions } from '../../../../store';
import { KeepAliveWorkSurface } from '../../KeepAliveWorkSurface';
import { SessionFrame } from '../../SessionRail/SessionFrame';
import { isDirectedScene } from '../demo/director/isDirectedScene';
import { WORKSPACE_ID, seedBoardScene } from './BoardScene';
import { sceneParam } from './audit/sceneParams';
import { SETTINGS_STORAGE_FOLDERS } from './audit/settingsSeed';
import { shellArrangement } from '../../../shellArrangement';
import { useSceneShell } from './useSceneShell';

const noop = () => undefined;

const seedBoardChrome = (): void => {
  useAppStore.setState({
    notifications: [],
    notificationsLoading: false,
    notificationCounts: [],
    loadNotifications: async () => undefined,
    markNotificationsRead: async () => undefined,
    clearNotifications: async () => undefined,
    scriptRuns: {},
    projectScripts: {},
    ...(isDirectedScene() ? {} : { navigate: () => undefined }),
    ...(sceneParam({ key: 'storage' }) === 'reclaimable'
      ? { storageFolders: [...SETTINGS_STORAGE_FOLDERS] }
      : {}),
  });
};

export const BoardShellScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedBoardScene();
    seedBoardChrome();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ToastProvider>
      <BoardShellSceneContent />
    </ToastProvider>
  );
};

const BoardShellSceneContent = () => {
  const sessions = useSessions();
  const currentSession = useCurrentSession();
  const arrangement = shellArrangement({
    hasWorkspace: true,
    isSidebarCollapsed: sceneParam({ key: 'rail' }) === '1',
  });
  const shell = useSceneShell({ arrangement });

  return (
    <>
      <AppShell
        studio={shell.studio}
        studioCoversLeft={arrangement.studioCoversLeft}
        topBar={
          <AppTopBar
            sidebar={{ isCollapsed: arrangement.isLeftRail, onToggle: noop }}
            onOpenSpend={noop}
            onOpenScript={noop}
          />
        }
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={
          <ShellLeft
            arrangement={arrangement}
            workspaceId={WORKSPACE_ID}
            currentSessionId={currentSession?.id ?? null}
            isDraftShown={false}
            actions={shell.actions}
            settingsSlotRef={shell.settingsSlotRef}
            {...(shell.isStudioOpen || currentSession !== null
              ? {}
              : { placeOverride: 'board' as const })}
          />
        }
        main={
          currentSession === null ? (
            <StageBoard workspaceId={WORKSPACE_ID} sessions={sessions} />
          ) : (
            <SessionFrame session={currentSession}>
              <KeepAliveWorkSurface sessionId={currentSession.id} isActive />
            </SessionFrame>
          )
        }
      />
      {shell.layers}
    </>
  );
};
