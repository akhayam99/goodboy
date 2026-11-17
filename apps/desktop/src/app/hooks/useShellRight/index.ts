import { createElement, useMemo, type ReactNode } from 'react';
import type { DockGridSpec, DrawerPlacement, DrawerSizing } from '@goodboy/ui';
import { DRAWER_KINDS } from '../../../store/slices/drawer/drawerKinds';
import { panelFocusKeyOf } from '../../../store/slices/drawer/panelFocusKeyOf';
import { shellPanelsOf } from '../../../store/slices/drawer/shellPanelsOf';
import { focusShellPanel } from '../../../shared/shellFocus/focusShellPanel';
import { turnShellPair } from '../../../shared/shellFocus/turnShellPair';
import { resizeShellColumn } from '../../../shared/shellFocus/resizeShellColumn';
import { selectDrawerPlacement } from '../../../store/slices/drawer/selectDrawerPlacement';
import { useAppStore } from '../../../store';
import { drawerSizingOf } from '../../../store/slices/drawer/drawerSizingOf';
import { selectDetailDrawer } from '../../../store/slices/drawer/selectDetailDrawer';
import { selectDockDrawer } from '../../../store/slices/drawer/selectDockDrawer';
import { ShellToolRail } from '../../components/ShellToolRail';
import { STUDIO_META } from '../../components/StudioFrame/studioMeta';

type Params = Record<never, never>;

type ShellRight = {
  readonly dockGrid: DockGridSpec;
  readonly rightRail: ReactNode;
  readonly isDrawerMounted: boolean;
  readonly isDrawerParked: boolean;
  readonly isDockInStudio: boolean;
  readonly isDetailMounted: boolean;
  readonly isDetailParked: boolean;
  readonly dockSizing: DrawerSizing;
  readonly detailSizing: DrawerSizing;
  readonly placement: DrawerPlacement;
};

export const useShellRight = ({}: Params): ShellRight => {
  const isRailInStudio = useAppStore((state) => {
    const kind = state.appStudio?.kind ?? null;
    const meta = kind === null ? null : STUDIO_META[kind];
    return meta !== null && 'canHostDrawer' in meta && meta.canHostDrawer;
  });
  const isDrawerMounted = useAppStore((state) => selectDockDrawer({ state }) !== null);
  const isDetailMounted = useAppStore((state) => selectDetailDrawer({ state }) !== null);
  const isStudioShown = useAppStore((state) => state.appStudio !== null);
  const dockSizing = useAppStore((state) =>
    drawerSizingOf({ drawer: selectDockDrawer({ state }) }),
  );
  const detailSizing = useAppStore((state) =>
    drawerSizingOf({ drawer: selectDetailDrawer({ state }) }),
  );
  const placement = useAppStore(selectDrawerPlacement);
  const drawer = useAppStore((state) => state.drawer);
  const drawerBack = useAppStore((state) => state.drawerBack);
  const drawerGrid = useAppStore((state) => state.drawerGrid);
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const appStudio = useAppStore((state) => state.appStudio);
  const dockGrid = useMemo<DockGridSpec>(() => {
    const panels = shellPanelsOf({
      state: { drawer, drawerBack, drawerGrid, currentSessionId, appStudio },
    });
    return {
      columns: panels.tools.map((column) =>
        column.map((panel) => ({
          key: panel.kind,
          sizing: DRAWER_KINDS[panel.kind].sizing,
          savedWidth: drawerGrid.widths[panel.kind],
        })),
      ),
      focus: panelFocusKeyOf({ panels }),
      onFocus: focusShellPanel,
      onTurn: turnShellPair,
      onResize: resizeShellColumn,
    };
  }, [drawer, drawerBack, drawerGrid, currentSessionId, appStudio]);
  return {
    dockGrid,
    placement,
    rightRail: isRailInStudio ? null : createElement(ShellToolRail),
    isDrawerMounted: isDrawerMounted || dockGrid.columns.length > 0,
    isDrawerParked: false,
    isDockInStudio: isRailInStudio,
    isDetailMounted,
    isDetailParked: isDetailMounted && isStudioShown,
    dockSizing,
    detailSizing,
  };
};
