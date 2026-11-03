import { useEffect, useState } from 'react';
import { AppShell, ScrollFade } from '@goodboy/ui';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { useAppStore } from '../../../../../store';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { shellArrangement } from '../../../../shellArrangement';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';
import { DrawerHost } from '../../../DrawerHost';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import { RailSessionButton } from '../../../SideColumn/RailSessionButton';
import { SESSION } from '../activityRunSeed';
import { seedRunningList } from '../u28/runningList/runningListSeed';

const LIMITS_GOAL = 'Add the tenant limit check to payout creation';

const LIMITS_SESSION = { ...SESSION, goal: LIMITS_GOAL };

type Props = {
  readonly isDrawerOpen?: boolean;
  readonly isFolded?: boolean;
  readonly isNarrowRow?: boolean;
};

export const LayoutFlowScene = ({
  isDrawerOpen = true,
  isFolded = false,
  isNarrowRow = false,
}: Props) => {
  const [isReady, setIsReady] = useState(false);
  const drawer = useAppStore((state) => state.drawer);
  const sizing = useAppStore(selectDrawerSizing);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sessionRailCollapsed, isFolded ? '1' : '0');
    seedRunningList();
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === SESSION.id ? { ...session, goal: LIMITS_GOAL } : session,
      ),
    }));
    if (isDrawerOpen) {
      useAppStore.getState().openDrawer({ kind: 'spawned', sessionId: SESSION.id, payload: null });
    }
    setIsReady(true);
  }, [isDrawerOpen, isFolded]);
  if (!isReady) {
    return null;
  }
  const overview = (
    <ScrollFade className="h-full">
      <SessionOverviewPane session={LIMITS_SESSION} />
    </ScrollFade>
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
  const arrangement = shellArrangement({ hasWorkspace: true, isSidebarCollapsed: isFolded });
  return (
    <AutoReleaseContext.Provider value>
      <div className="h-screen bg-background text-foreground">
        <AppShell
          leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
          leftSidebar={
            <div className="flex flex-col items-center gap-2 p-2">
              <RailSessionButton
                session={LIMITS_SESSION}
                sign="current"
                hasFlyout={false}
                onSelect={() => undefined}
              />
            </div>
          }
          main={<SessionFrame session={LIMITS_SESSION}>{overview}</SessionFrame>}
          drawer={drawer === null ? null : <DrawerHost />}
          drawerSizing={sizing}
        />
      </div>
    </AutoReleaseContext.Provider>
  );
};
