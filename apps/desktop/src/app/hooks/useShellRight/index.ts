import { createElement, type ReactNode } from 'react';
import { useAppStore } from '../../../store';
import { selectDrawerPanel } from '../../../store/slices/drawer/selectDrawerPanel';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { ShellToolRail } from '../../components/ShellToolRail';
import { STUDIO_META } from '../../components/StudioFrame/studioMeta';

type Params = Record<never, never>;

type ShellRight = {
  readonly rightRail: ReactNode;
  readonly isDrawerMounted: boolean;
  readonly isDrawerParked: boolean;
};

export const useShellRight = ({}: Params): ShellRight => {
  const isRailInStudio = useAppStore((state) => {
    const kind = state.appStudio?.kind ?? null;
    const meta = kind === null ? null : STUDIO_META[kind];
    return meta !== null && 'canHostDrawer' in meta && meta.canHostDrawer;
  });
  const isDrawerMounted = useAppStore((state) => {
    const open = selectOpenDrawer(state);
    return open !== null && open.kind !== state.appStudio?.kind;
  });
  const isDrawerParked = useAppStore(
    (state) => selectOpenDrawer(state) !== null && selectDrawerPanel(state) === null,
  );
  return {
    rightRail: isRailInStudio ? null : createElement(ShellToolRail),
    isDrawerMounted,
    isDrawerParked,
  };
};
