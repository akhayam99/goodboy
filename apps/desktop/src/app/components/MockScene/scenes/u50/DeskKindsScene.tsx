import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { selectDetailDrawer } from '../../../../../store/slices/drawer/selectDetailDrawer';
import { DrawerHost } from '../../../DrawerHost';
import { ScenePlacesRail } from '../ScenePlacesRail';
import { COLUMN_SESSION_ID, seedCentralColumn } from '../u26/centralColumnSeed';
import { DeskFacePane } from './DeskFacePane';

type Props = {
  readonly theme: 'dark' | 'light';
};

const openDeskPair = () => {
  const state = useAppStore.getState();
  const mount = state.sessionProjectMounts[COLUMN_SESSION_ID]?.[0];
  const agent = (state.sessionPhaseRuns[COLUMN_SESSION_ID] ?? []).find(
    (run) => run.status === 'running',
  );
  if (agent !== undefined) {
    state.openDrawer({
      kind: 'transcript',
      sessionId: COLUMN_SESSION_ID,
      payload: { agentId: agent.id },
    });
  }
  if (mount !== undefined) {
    state.openDrawer({
      kind: 'pull-request',
      sessionId: COLUMN_SESSION_ID,
      payload: { mountId: mount.mountId, tab: 'checks' },
    });
  }
};

export const DeskKindsScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const isDetailOpen = useAppStore((state) => selectDetailDrawer({ state }) !== null);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedCentralColumn({ kind: 'mid' });
    const state = useAppStore.getState();
    state.navigate({ to: sessionPlace({ sessionId: COLUMN_SESSION_ID }) });
    state.setSessionFace({ sessionId: COLUMN_SESSION_ID, face: 'desk' });
    openDeskPair();
    setIsReady(true);
  }, [theme]);
  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <div data-shot className="h-screen w-screen [&>div]:h-full [&>div]:w-full">
        <AppShell
          leftRail={<ScenePlacesRail />}
          main={<DeskFacePane />}
          drawer={null}
          detail={isDetailOpen ? <DrawerHost slot="detail" /> : null}
          detailSizing="reader"
          detailKind="desk-kinds"
        />
      </div>
    </AutoReleaseContext.Provider>
  );
};
