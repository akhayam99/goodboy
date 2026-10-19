import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { SETTING_OVERVIEW_LAYOUT } from '../../../../../features/settings/settings';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerPlacement } from '../../../../../store/slices/drawer/selectDrawerPlacement';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { shellArrangement } from '../../../../shellArrangement';
import { CentralColumnPane } from './CentralColumnPane';
import { COLUMN_SESSION_ID, seedCentralColumn, type ColumnKind } from './centralColumnSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly kind: ColumnKind;
  readonly isLogOpen?: boolean;
  readonly layout?: 'new' | 'classic';
  readonly isArchived?: boolean;
};

const arrangement = shellArrangement({ hasWorkspace: true, isSidebarCollapsed: true });

const ARCHIVED_AT = brandId<IsoDateTime>({ value: '2026-10-18T09:00:00.000Z' });

const WIDTH = 1180;
const HEIGHT = 900;

export const CentralColumnScene = ({
  theme,
  kind,
  isLogOpen = false,
  layout = 'new',
  isArchived = false,
}: Props) => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const drawerSizing = useAppStore(selectDrawerSizing);
  const drawerPlacement = useAppStore(selectDrawerPlacement);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedCentralColumn({ kind });
    useAppStore.setState((state) => ({
      settings: { ...state.settings, [SETTING_OVERVIEW_LAYOUT]: layout },
      sessions: state.sessions.map((session) =>
        session.id === COLUMN_SESSION_ID && isArchived
          ? { ...session, archivedAt: ARCHIVED_AT }
          : session,
      ),
    }));
    if (isLogOpen) {
      useAppStore.getState().openDrawer({
        kind: 'session-log',
        sessionId: COLUMN_SESSION_ID,
        payload: { focusEntryId: null },
      });
    }
    setIsReady(true);
  }, [theme, kind, isLogOpen, layout, isArchived]);
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
          leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
          leftSidebar={<div aria-hidden />}
          main={<CentralColumnPane />}
          drawer={isDrawerOpen ? <DrawerHost /> : null}
          drawerSizing={drawerSizing}
          drawerPlacement={drawerPlacement}
        />
      </div>
    </AutoReleaseContext.Provider>
  );
};
