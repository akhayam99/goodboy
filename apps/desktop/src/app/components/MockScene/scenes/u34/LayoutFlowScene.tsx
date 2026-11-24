import { useEffect, useState } from 'react';
import { AppShell, ScrollFade, UnderTrailContext } from '@goodboy/ui';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { useAppStore } from '../../../../../store';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/testing/selectDrawerSizing';
import { shellArrangement } from '../../../../shellArrangement';
import { DrawerHost } from '../../../DrawerHost';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import { SessionHead } from '../../../SessionHead';
import type { ColumnActions } from '../../../ShellLeft/columnDoors';
import { ShellLeft } from '../../../ShellLeft';
import { SESSION } from '../activityRunSeed';
import { seedRunningList } from '../u28/runningList/runningListSeed';
import { seedFourBranches } from './seedFourBranches';

const noop = () => undefined;

const ACTIONS: ColumnActions = {
  openBoard: noop,
  openInbox: noop,
  openChat: noop,
  openWorkflows: noop,
  openNewChat: noop,
  openConnections: noop,
  openMonitoring: noop,
  openImpact: noop,
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
};

const LIMITS_GOAL = 'Add the tenant limit check to payout creation';

const LIMITS_SESSION = { ...SESSION, goal: LIMITS_GOAL };

type Props = {
  readonly isDrawerOpen?: boolean;
  readonly isNarrowRow?: boolean;
  readonly isFourBranches?: boolean;
};

export const LayoutFlowScene = ({
  isDrawerOpen = true,
  isNarrowRow = false,
  isFourBranches = false,
}: Props) => {
  const [isReady, setIsReady] = useState(false);
  const drawer = useAppStore((state) => state.drawer);
  const sizing = useAppStore(selectDrawerSizing);
  useEffect(() => {
    seedRunningList();
    if (isFourBranches) {
      seedFourBranches();
    }
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === SESSION.id ? { ...session, goal: LIMITS_GOAL } : session,
      ),
    }));
    if (isDrawerOpen) {
      useAppStore.getState().openDrawer({ kind: 'scripts', sessionId: SESSION.id, payload: null });
    }
    setIsReady(true);
  }, [isDrawerOpen, isFourBranches]);
  if (!isReady) {
    return null;
  }
  const overview = (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <SessionHead session={LIMITS_SESSION} />
      <UnderTrailContext.Provider value>
        <ScrollFade className="min-h-0 flex-1">
          <SessionOverviewPane session={LIMITS_SESSION} />
        </ScrollFade>
      </UnderTrailContext.Provider>
    </div>
  );
  if (isNarrowRow) {
    return (
      <AutoReleaseContext.Provider value>
        <div style={{ width: 310, height: 900 }} className="bg-background text-foreground">
          {overview}
        </div>
      </AutoReleaseContext.Provider>
    );
  }
  const arrangement = shellArrangement({ hasWorkspace: true });
  return (
    <AutoReleaseContext.Provider value>
      <div className="h-screen bg-background text-foreground">
        <AppShell
          leftRail={
            <ShellLeft
              arrangement={arrangement}
              workspaceId={SESSION.workspaceId}
              actions={ACTIONS}
              placeOverride={null}
            />
          }
          main={<SessionFrame session={LIMITS_SESSION}>{overview}</SessionFrame>}
          drawer={drawer === null ? null : <DrawerHost />}
          drawerSizing={sizing}
        />
      </div>
    </AutoReleaseContext.Provider>
  );
};
