import { Suspense, lazy, useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AppTopBar } from '../../AppTopBar';
import { DrawerHost } from '../../DrawerHost';
import { ShellLeft } from '../../ShellLeft';
import { ToastProvider } from '../../../../shared/components/Toast';
import { StageBoard } from '../../../../features/workspace/components/StageBoard';
import { useAppStore, useCurrentSession, useSessions } from '../../../../store';
import { isDirectedScene } from '../../../../shared/utils/isDirectedScene';
import { WORKSPACE_ID, seedBoardScene } from './BoardScene';
import { sceneParam } from './audit/sceneParams';
import { SETTINGS_STORAGE_FOLDERS } from './audit/settingsSeed';
import { shellArrangement } from '../../../shellArrangement';
import { useShellRight } from '../../../hooks/useShellRight';
import { useSceneShell } from './useSceneShell';

const noop = () => undefined;

const BoardSessionView = lazy(() =>
  import('./BoardSessionView').then((module) => ({ default: module.BoardSessionView })),
);

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

type Props = {
  readonly afterSeed?: () => void;
  readonly isSessionOpen?: boolean;
};

export const BoardShellScene = ({ afterSeed = noop, isSessionOpen = false }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedBoardScene();
    seedBoardChrome();
    afterSeed();
    setIsReady(true);
  }, [afterSeed]);

  if (!isReady) {
    return null;
  }

  return (
    <ToastProvider>
      <BoardShellSceneContent isSessionOpen={isSessionOpen} />
    </ToastProvider>
  );
};

type ContentProps = {
  readonly isSessionOpen: boolean;
};

const BoardShellSceneContent = ({ isSessionOpen }: ContentProps) => {
  const sessions = useSessions();
  const current = useCurrentSession();
  const currentSession = isDirectedScene() || isSessionOpen ? current : null;
  const arrangement = shellArrangement({ hasWorkspace: true });
  const shell = useSceneShell({});
  const shellRight = useShellRight({});

  return (
    <>
      <AppShell
        rightRail={shellRight.rightRail}
        drawer={shellRight.isDrawerMounted ? <DrawerHost slot="dock" /> : null}
        drawerSizing={shellRight.dockSizing}
        dockGrid={shellRight.dockGrid}
        detail={shellRight.isDetailMounted ? <DrawerHost slot="detail" /> : null}
        detailSizing={shellRight.detailSizing}
        isDrawerParked={shellRight.isDrawerParked}
        isDetailParked={shellRight.isDetailParked}
        studio={shell.studio}
        isDockInStudio={shellRight.isDockInStudio}
        topBar={<AppTopBar onOpenSpend={noop} onOpenScript={noop} />}
        leftRail={
          <ShellLeft
            arrangement={arrangement}
            workspaceId={WORKSPACE_ID}
            actions={shell.actions}
            {...(shell.isStudioOpen || currentSession !== null
              ? {}
              : { placeOverride: 'board' as const })}
          />
        }
        main={
          currentSession === null ? (
            <StageBoard workspaceId={WORKSPACE_ID} sessions={sessions} />
          ) : (
            <Suspense fallback={null}>
              <BoardSessionView session={currentSession} />
            </Suspense>
          )
        }
      />
      {shell.layers}
    </>
  );
};
