import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AppFooter } from '../../AppFooter';
import { AppTopBar } from '../../AppTopBar';
import { ToastProvider } from '../../Toast';
import { StageBoard } from '../../../../features/workspace/components/StageBoard';
import { useAppStore, useSessions } from '../../../../store';
import { shellArrangement } from '../../../shellArrangement';
import { WORKSPACE_ID, seedBoardScene } from './BoardScene';

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
    isSidebarCollapsed: false,
  });

  return (
    <AppShell
      topBar={<AppTopBar onOpenSpend={noop} onOpenScript={noop} />}
      leftHidden={arrangement.leftHidden}
      leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
      leftSidebar={undefined}
      footer={
        <AppFooter
          scope={arrangement.footer}
          target={null}
          connected={{
            github: true,
            linear: true,
            jira: true,
            sentry: true,
            gitlab: false,
            bitbucket: false,
            slack: false,
          }}
          onOpenIntegration={noop}
          onOpenInbox={noop}
          onOpenWorkflows={noop}
          onOpenSettings={noop}
          onOpenShortcuts={noop}
          onOpenChangelog={noop}
        />
      }
      main={<StageBoard workspaceId={WORKSPACE_ID} sessions={sessions} />}
    />
  );
};
