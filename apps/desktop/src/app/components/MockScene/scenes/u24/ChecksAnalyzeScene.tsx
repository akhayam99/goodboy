import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { DrawerHost } from '../../../DrawerHost';
import { BranchChecks } from '../../../../../features/branch/components/BranchChecks';
import { SESSION_ID } from '../activityRunSeed';
import { checksAnalyzeSeed } from './checksAnalyzeSeed';
import { shellArrangement } from '../../../../shellArrangement';

const arrangement = shellArrangement({
  hasWorkspace: true,
  hasActiveSession: true,
  isSidebarCollapsed: false,
});

type Props = {
  readonly phase: 'failing' | 'running' | 'proposal';
  readonly shouldOpenDrawer?: boolean;
  readonly analysisText?: string;
  readonly log?: string;
};

export const ChecksAnalyzeScene = ({
  phase,
  shouldOpenDrawer = false,
  analysisText,
  log,
}: Props) => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  useEffect(() => {
    checksAnalyzeSeed({
      phase,
      shouldOpenDrawer,
      ...(analysisText !== undefined && { analysisText }),
      ...(log !== undefined && { log }),
    });
    setIsReady(true);
  }, [phase, shouldOpenDrawer, analysisText, log]);
  if (!isReady) {
    return null;
  }
  return (
    <div className="[&>div]:w-full" style={{ width: 1360 }}>
      <AppShell
        leftHidden={arrangement.leftHidden}
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={<div aria-hidden />}
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
