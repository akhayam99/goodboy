import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AutoReleaseContext } from '../../../../../../features/auto/autoReleaseContext';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../../store';
import { selectDrawerPlacement } from '../../../../../../store/slices/drawer/selectDrawerPlacement';
import { selectDrawerSizing } from '../../../../../../store/slices/drawer/testing/selectDrawerSizing';
import { ScenePlacesRail } from '../../ScenePlacesRail';
import { CentralColumnPane } from '../../u26/CentralColumnPane';
import { seedRunningList } from './runningListSeed';

type Props = {
  readonly theme: 'dark' | 'light';
};

const WIDTH = 1180;
const HEIGHT = 760;

export const RunningListScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const drawerSizing = useAppStore(selectDrawerSizing);
  const drawerPlacement = useAppStore(selectDrawerPlacement);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedRunningList();
    setIsReady(true);
  }, [theme]);
  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <div
        data-shot
        style={{ width: WIDTH, height: HEIGHT }}
        className="[&>div]:h-full [&>div]:w-full"
      >
        <AppShell
          leftRail={<ScenePlacesRail />}
          main={<CentralColumnPane />}
          drawer={null}
          drawerSizing={drawerSizing}
          drawerPlacement={drawerPlacement}
        />
      </div>
    </AutoReleaseContext.Provider>
  );
};
