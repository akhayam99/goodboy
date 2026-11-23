import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { toggleRailTool } from '../../../../../features/session/components/SessionTools/toggleRailTool';
import type { RailToolId } from '../../../../../features/session/components/SessionTools/sessionTools';
import { deskLines } from '../../../../../features/session/components/SessionDesk/useDeskOwner/deskLines';
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

type Props = {
  readonly theme: 'dark' | 'light';
  readonly tool: RailToolId | null;
};

export const FbFaceScene = ({ theme, tool }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const drawerSizing = useAppStore(selectDrawerSizing);
  const drawerPlacement = useAppStore(selectDrawerPlacement);
  useEffect(() => {
    applyDocumentTheme({ theme });
    deskLines.reset();
    seedCentralColumn({ kind: 'branches' });
    const state = useAppStore.getState();
    state.navigate({ to: sessionPlace({ sessionId: COLUMN_SESSION_ID }) });
    state.setSessionFace({ sessionId: COLUMN_SESSION_ID, face: 'overview' });
    setIsReady(true);
    if (tool === null) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      toggleRailTool({ pane: tool, sessionId: COLUMN_SESSION_ID });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [theme, tool]);
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
