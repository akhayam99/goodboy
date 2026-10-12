import { useEffect, useState } from 'react';
import { AppShell, ScrollFade } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { BranchChecks } from '../../../../../features/branch/components/BranchChecks';
import { DrawerHost } from '../../../DrawerHost';
import { shellArrangement } from '../../../../shellArrangement';
import { SESSION, SESSION_ID } from '../activityRunSeed';
import { analyzeFixSeed } from './analyzeFixSeed';

const arrangement = shellArrangement({
  hasWorkspace: true,
  isSidebarCollapsed: false,
});

type Props = {
  readonly phase: 'proposal' | 'fixing';
  readonly surface: 'checks' | 'activity';
  readonly shouldOpenDrawer?: boolean;
};

export const AnalyzeFixScene = ({ phase, surface, shouldOpenDrawer = false }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  useEffect(() => {
    analyzeFixSeed({ phase, shouldOpenDrawer });
    setIsReady(true);
  }, [phase, shouldOpenDrawer]);
  if (!isReady) {
    return null;
  }
  if (surface === 'activity') {
    return (
      <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <ScrollFade className="min-h-0 flex-1">
          <div className="px-6 py-4">
            <SessionOverviewPane session={SESSION} onSelectLens={() => undefined} />
          </div>
        </ScrollFade>
      </main>
    );
  }
  return (
    <div className="[&>div]:w-full" style={{ width: 1440 }}>
      <AppShell
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
