import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import type { BrowserTabState } from '../../../../../features/browser/types';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerPlacement } from '../../../../../store/slices/drawer/selectDrawerPlacement';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/testing/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { ScenePlacesRail } from '../ScenePlacesRail';
import { COLUMN_SESSION_ID, seedCentralColumn } from '../u26/centralColumnSeed';
import { DeskFacePane } from './DeskFacePane';
import { seedParkedBrowser } from './seedParkedBrowser';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly tabState: BrowserTabState;
};

export const DeskOwnsScene = ({ theme, tabState }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const drawerSizing = useAppStore(selectDrawerSizing);
  const drawerPlacement = useAppStore(selectDrawerPlacement);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedCentralColumn({ kind: 'branches' });
    seedParkedBrowser({ sessionId: COLUMN_SESSION_ID, state: tabState });
    const state = useAppStore.getState();
    state.navigate({ to: sessionPlace({ sessionId: COLUMN_SESSION_ID }) });
    state.setSessionFace({ sessionId: COLUMN_SESSION_ID, face: 'desk' });
    state.openDrawer({ kind: 'browser', sessionId: COLUMN_SESSION_ID, payload: null });
    setIsReady(true);
  }, [theme, tabState]);
  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <div data-shot className="h-screen w-screen [&>div]:h-full [&>div]:w-full">
        <AppShell
          leftRail={<ScenePlacesRail />}
          main={<DeskFacePane />}
          drawer={isDrawerOpen ? <DrawerHost /> : null}
          drawerSizing={drawerSizing}
          drawerPlacement={drawerPlacement}
        />
      </div>
    </AutoReleaseContext.Provider>
  );
};
