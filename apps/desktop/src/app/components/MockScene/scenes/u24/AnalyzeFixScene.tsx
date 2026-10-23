import { useEffect, useState } from 'react';
import { AppShell, ScrollFade } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { TimelinePane } from '../../../../../features/session/components/SessionWorkspace/parts/TimelinePane';
import { BranchChecks } from '../../../../../features/branch/components/BranchChecks';
import { DrawerHost } from '../../../DrawerHost';
import { shellArrangement } from '../../../../shellArrangement';
import { SESSION, SESSION_ID } from '../activityRunSeed';
import { analyzeFixSeed, type AnalyzeFixPhase } from './analyzeFixSeed';
import { unloadedDetailSeed } from './unloadedDetailSeed';

const arrangement = shellArrangement({
  hasWorkspace: true,
  isSidebarCollapsed: false,
});

type Props = {
  readonly phase: AnalyzeFixPhase;
  readonly surface: 'checks' | 'activity' | 'timeline';
  readonly shouldOpenDrawer?: boolean;
  readonly isDetailUnloaded?: boolean;
  readonly isLogOpen?: boolean;
};

export const AnalyzeFixScene = ({
  phase,
  surface,
  shouldOpenDrawer = false,
  isDetailUnloaded = false,
  isLogOpen = false,
}: Props) => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  useEffect(() => {
    analyzeFixSeed({ phase, shouldOpenDrawer });
    if (isDetailUnloaded) {
      unloadedDetailSeed();
    }
    if (isLogOpen) {
      useAppStore.getState().openDrawer({
        kind: 'session-log',
        sessionId: SESSION_ID,
        payload: { focusEntryId: null },
      });
    }
    setIsReady(true);
  }, [phase, shouldOpenDrawer, isDetailUnloaded, isLogOpen]);
  if (!isReady) {
    return null;
  }
  const main =
    surface === 'timeline' ? (
      <div className="relative h-full w-full">
        <TimelinePane session={SESSION} />
      </div>
    ) : surface === 'activity' ? (
      <ScrollFade className="min-h-0 flex-1">
        <div className="px-6 py-4">
          <SessionOverviewPane session={SESSION} />
        </div>
      </ScrollFade>
    ) : (
      <div className="flex h-full min-w-0 flex-col gap-4 py-4">
        <BranchChecks sessionId={SESSION_ID} />
      </div>
    );
  return (
    <div className="[&>div]:w-full" style={{ width: 1440 }}>
      <AppShell
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={<div aria-hidden />}
        main={main}
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        drawerSizing="side"
      />
    </div>
  );
};
