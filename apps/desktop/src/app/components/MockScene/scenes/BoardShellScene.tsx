import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AppTopBar } from '../../AppTopBar';
import { ShellLeft } from '../../SideColumn/ShellLeft';
import { ToastProvider } from '../../../../shared/components/Toast';
import { StageBoard } from '../../../../features/workspace/components/StageBoard';
import { useAppStore, useSessions } from '../../../../store';
import { shellArrangement } from '../../../shellArrangement';
import { WORKSPACE_ID, seedBoardScene } from './BoardScene';
import { sceneParam } from './audit/sceneParams';
import { SETTINGS_STORAGE_FOLDERS } from './audit/settingsSeed';
import { SceneFooter } from './SceneFooter';
import { SCENE_COLUMN_ACTIONS, sceneShellMode } from './sceneShell';

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
    navigate: () => undefined,
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
  const arrangement = shellArrangement({
    hasWorkspace: true,
    hasActiveSession: false,
    isSidebarCollapsed: sceneParam({ key: 'rail' }) === '1',
    mode: sceneShellMode(),
  });

  return (
    <AppShell
      topBar={
        <AppTopBar
          mode={arrangement.mode}
          onOpenSpend={noop}
          onOpenScript={noop}
          onOpenImpact={noop}
        />
      }
      leftHidden={arrangement.leftHidden}
      leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
      leftSidebar={
        arrangement.leftSlot === 'none' ? undefined : (
          <ShellLeft
            arrangement={arrangement}
            workspaceId={WORKSPACE_ID}
            currentSessionId={null}
            isDraftShown={false}
            actions={SCENE_COLUMN_ACTIONS}
            onToggle={noop}
            placeOverride="board"
          />
        )
      }
      footer={
        arrangement.footer === null ? undefined : (
          <SceneFooter
            scope={arrangement.footer}
            connected={{
              github: true,
              linear: true,
              jira: true,
              sentry: true,
              gitlab: false,
              bitbucket: false,
              slack: false,
            }}
          />
        )
      }
      main={
        <StageBoard
          workspaceId={WORKSPACE_ID}
          sessions={sessions}
          hasNewSession={arrangement.mode === 'classic'}
        />
      }
    />
  );
};
