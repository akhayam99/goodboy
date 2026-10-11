import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { DrawerHost } from '../../../DrawerHost';
import { BranchChecks } from '../../../../../features/branch/components/BranchChecks';
import { SESSION_ID } from '../activityRunSeed';
import { checksAnalyzeSeed } from './checksAnalyzeSeed';

type Props = {
  readonly phase: 'failing' | 'running' | 'proposal';
  readonly shouldOpenDrawer?: boolean;
};

export const ChecksAnalyzeScene = ({ phase, shouldOpenDrawer = false }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  useEffect(() => {
    checksAnalyzeSeed({ phase, shouldOpenDrawer });
    setIsReady(true);
  }, [phase, shouldOpenDrawer]);
  if (!isReady) {
    return null;
  }
  return (
    <div className="[&>div]:w-full" style={{ width: 1440 }}>
      <AppShell
        leftHidden
        leftSidebarCollapsed={false}
        leftSidebar={null}
        main={
          <div className="flex h-full min-w-0 flex-col gap-4 py-4">
            <BranchChecks sessionId={SESSION_ID} />
          </div>
        }
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        drawerSizing="side"
      />
    </div>
  );
};
