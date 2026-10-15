import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { START_HINT_SCOPES } from '../../../../../store/slices/startHints/startHintScopes';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { DrawerHost } from '../../../DrawerHost';
import { BranchChecks } from '../../../../../features/branch/components/BranchChecks';
import { SESSION_ID } from '../activityRunSeed';
import { checksAnalyzeSeed } from './checksAnalyzeSeed';
import { shellArrangement } from '../../../../shellArrangement';

const arrangement = shellArrangement({
  hasWorkspace: true,
  isSidebarCollapsed: false,
});

type Props = {
  readonly phase: 'failing' | 'running' | 'proposal';
  readonly shouldOpenDrawer?: boolean;
  readonly analysisText?: string;
  readonly log?: string;
  readonly hint?: string;
};

export const ChecksAnalyzeScene = ({
  phase,
  shouldOpenDrawer = false,
  analysisText,
  log,
  hint,
}: Props) => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  useEffect(() => {
    const seeded = checksAnalyzeSeed({
      phase,
      shouldOpenDrawer,
      ...(analysisText !== undefined && { analysisText }),
      ...(log !== undefined && { log }),
    });
    if (hint !== undefined) {
      useAppStore.getState().setStartHint({
        sessionId: seeded.sessionId,
        scope: START_HINT_SCOPES.checkFix({
          mountId: seeded.repo.mountId,
          url: seeded.check.detailsUrl ?? '',
        }),
        text: hint,
      });
    }
    setIsReady(true);
  }, [phase, shouldOpenDrawer, analysisText, log, hint]);
  if (!isReady) {
    return null;
  }
  return (
    <div className="[&>div]:w-full" style={{ width: 1360 }}>
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
