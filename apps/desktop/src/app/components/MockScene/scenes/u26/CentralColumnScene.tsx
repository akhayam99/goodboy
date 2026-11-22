import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerPlacement } from '../../../../../store/slices/drawer/selectDrawerPlacement';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/testing/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { ScenePlacesRail } from '../ScenePlacesRail';
import { CentralColumnPane } from './CentralColumnPane';
import { COLUMN_SESSION_ID, seedCentralColumn, type ColumnKind } from './centralColumnSeed';

type Props = {
  readonly theme?: 'dark' | 'light';
  readonly kind: ColumnKind;
  readonly isLogOpen?: boolean;
  readonly isArchived?: boolean;
  readonly search?: string;
};

const ARCHIVED_AT = brandId<IsoDateTime>({ value: '2026-10-18T09:00:00.000Z' });

const WIDTH = 1180;
const HEIGHT = 900;

export const CentralColumnScene = ({
  theme,
  kind,
  isLogOpen = false,
  isArchived = false,
  search,
}: Props) => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const drawerSizing = useAppStore(selectDrawerSizing);
  const drawerPlacement = useAppStore(selectDrawerPlacement);
  useEffect(() => {
    if (theme !== undefined) {
      applyDocumentTheme({ theme });
    }
    seedCentralColumn({ kind });
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === COLUMN_SESSION_ID && isArchived
          ? { ...session, archivedAt: ARCHIVED_AT }
          : session,
      ),
    }));
    setIsReady(true);
  }, [theme, kind, isArchived]);
  useEffect(() => {
    if (!isReady || search === undefined) {
      return;
    }
    const field = document.querySelector<HTMLInputElement>('input[type="search"]');
    if (field === null) {
      return;
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(field, search);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }, [isReady, search]);
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
          main={<CentralColumnPane isLogOpen={isLogOpen} />}
          drawer={isDrawerOpen ? <DrawerHost /> : null}
          drawerSizing={drawerSizing}
          drawerPlacement={drawerPlacement}
        />
      </div>
    </AutoReleaseContext.Provider>
  );
};
