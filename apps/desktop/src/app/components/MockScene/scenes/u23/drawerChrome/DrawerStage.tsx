import { useEffect, useState, type ReactNode } from 'react';
import { DrawerColumn, UnderTrailContext } from '@goodboy/ui';
import { AskTrailButton } from '../../../../../../features/session/ask/components/AskTrailButton';
import { SessionOverviewPane } from '../../../../../../features/session/components/SessionOverviewPane';
import { TrailBar } from '../../../../../../features/session/components/SessionWorkspace/parts/TrailBar';
import { useAppStore } from '../../../../../../store';
import { selectDrawerPanel } from '../../../../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerSizing } from '../../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../../DrawerHost';
import { SESSION, SESSION_ID, seedActivityRunScene } from '../../activityRunSeed';

const noop = () => undefined;

type Props = {
  readonly width: number;
  readonly prepare: () => void;
  readonly children?: ReactNode;
};

export const DrawerStage = ({ width, prepare, children }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const sizing = useAppStore(selectDrawerSizing);

  useEffect(() => {
    seedActivityRunScene();
    useAppStore.setState({ selectedAgentId: {} });
    prepare();
    setIsReady(true);
  }, [prepare]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen bg-background text-foreground" style={{ width }}>
      <DrawerColumn
        main={
          <div className="@container flex h-full w-full min-w-0 flex-col">
            <TrailBar session={SESSION} end={<AskTrailButton sessionId={SESSION_ID} />} />
            <UnderTrailContext.Provider value>
              <div className="min-h-0 flex-1">
                <SessionOverviewPane session={SESSION} onSelectLens={noop} />
              </div>
            </UnderTrailContext.Provider>
            {children}
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
