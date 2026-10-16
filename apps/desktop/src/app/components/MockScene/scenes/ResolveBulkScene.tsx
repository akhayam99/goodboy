import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { DrawerHost } from '../../DrawerHost';
import { shellArrangement } from '../../../shellArrangement';
import { openFixComments } from '../../../../store/slices/resolve/openFixComments';
import { BranchPage } from '../../../../features/branch/components/BranchPage';
import { WorktreeSceneColumn } from './WorktreeSceneColumn';
import { useAppStore } from '../../../../store';
import { SESSION } from './resolveSeed';
import { BULK_LAUNCH_THREAD_IDS, seedBulkScene, type BulkStage } from './bulkSeed';

const arrangement = shellArrangement({
  hasWorkspace: true,
  isSidebarCollapsed: false,
});

const ANSWERS_BUTTON = /^Use the recommended answers/;
const OPEN_ATTEMPTS = 20;

const openAnswersPanel = (attempt = 0): void => {
  const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
    ANSWERS_BUTTON.test(candidate.textContent ?? ''),
  );
  if (button !== undefined) {
    button.click();
    return;
  }
  if (attempt < OPEN_ATTEMPTS) {
    requestAnimationFrame(() => openAnswersPanel(attempt + 1));
  }
};

export const ResolveBulkScene = ({ stage }: { readonly stage: BulkStage }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedBulkScene({ stage });
    if (stage === 'launch') {
      openFixComments({
        openDrawer: useAppStore.getState().openDrawer,
        sessionId: SESSION.id,
        mountId: null,
        threadIds: BULK_LAUNCH_THREAD_IDS,
      });
    }
    setIsReady(true);
    if (stage === 'answers') {
      openAnswersPanel();
    }
  }, [stage]);

  if (!isReady) {
    return null;
  }

  if (stage === 'launch') {
    return (
      <div className="[&>div]:w-full" style={{ width: 1440 }}>
        <AppShell
          leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
          leftSidebar={<div aria-hidden />}
          main={<BranchPage session={SESSION} workingDir={null} />}
          drawer={<DrawerHost />}
          drawerSizing="side"
        />
      </div>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <WorktreeSceneColumn>
        <BranchPage session={SESSION} workingDir={null} />
      </WorktreeSceneColumn>
    </main>
  );
};
