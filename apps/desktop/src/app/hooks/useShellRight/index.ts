import { createElement, type ReactNode } from 'react';
import type { DrawerPlacement, DrawerSizing } from '@goodboy/ui';
import { selectDrawerPlacement } from '../../../store/slices/drawer/selectDrawerPlacement';
import { useAppStore } from '../../../store';
import { drawerSizingOf } from '../../../store/slices/drawer/drawerSizingOf';
import { selectDetailDrawer } from '../../../store/slices/drawer/selectDetailDrawer';
import { selectDockDrawer } from '../../../store/slices/drawer/selectDockDrawer';
import { ShellToolRail } from '../../components/ShellToolRail';
import { STUDIO_META } from '../../components/StudioFrame/studioMeta';

type Params = Record<never, never>;

type ShellRight = {
  readonly rightRail: ReactNode;
  readonly isDrawerMounted: boolean;
  readonly isDrawerParked: boolean;
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
  return {
    placement,
    rightRail: isRailInStudio ? null : createElement(ShellToolRail),
    isDrawerMounted,
    isDrawerParked: false,
    isDetailMounted,
    isDetailParked: isDetailMounted && isStudioShown,
    dockSizing,
    detailSizing,
  };
};
