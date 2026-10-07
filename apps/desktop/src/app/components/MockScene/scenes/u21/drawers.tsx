import { useEffect, useState } from 'react';
import { DrawerColumn, UnderTrailContext } from '@goodboy/ui';
import { AskTrailButton } from '../../../../../features/session/ask/components/AskTrailButton';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { TrailBar } from '../../../../../features/session/components/SessionWorkspace/parts/TrailBar';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { SESSION, seedActivityRunScene } from '../activityRunSeed';
import { PlannerTranscriptScene } from '../PlannerTranscriptScene';
import { seedSessionAsk } from '../sessionAskSeed';

const NARROW_WIDTH_PX = 1000;
const WIDE_WIDTH_PX = 1440;

const noop = () => undefined;

export const DrawerOverlayNarrowScene = () => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const sizing = useAppStore(selectDrawerSizing);

  useEffect(() => {
    seedActivityRunScene();
    useAppStore.setState({ selectedAgentId: {} });
    seedSessionAsk({ state: 'answer' });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main
      className="flex h-screen bg-background text-foreground"
      style={{ width: NARROW_WIDTH_PX }}
    >
      <DrawerColumn
        main={
          <div className="@container flex h-full w-full min-w-0 flex-col">
            <TrailBar
              session={SESSION}
              width="column"
              end={<AskTrailButton sessionId={SESSION.id} />}
            />
            <UnderTrailContext.Provider value>
              <div className="min-h-0 flex-1">
                <SessionOverviewPane session={SESSION} onSelectLens={noop} />
              </div>
            </UnderTrailContext.Provider>
          </div>
        }
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        sizing={sizing}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />
    </main>
  );
};

export const DrawerWidePushScene = () => (
  <div style={{ width: WIDE_WIDTH_PX }}>
    <PlannerTranscriptScene variant="drawer" />
  </div>
);

export const U21_DRAWERS_SCENES = {
  'drawer-overlay-narrow': DrawerOverlayNarrowScene,
  'drawer-wide-push': DrawerWidePushScene,
};
