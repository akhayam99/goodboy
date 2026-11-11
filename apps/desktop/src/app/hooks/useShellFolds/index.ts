import { useContext } from 'react';
import { DrawerContentContext, RIGHT_DRAWER_DEFAULT } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { selectDrawerSizing } from '../../../store/slices/drawer/selectDrawerSizing';
import { shellFoldsOf, type ShellFolds } from '../../shellArrangement/shellFoldsOf';

type Params = { readonly railWidth: number; readonly toolsWidth: number };

export const useShellFolds = ({ railWidth, toolsWidth }: Params): ShellFolds => {
  const context = useContext(DrawerContentContext);
  const paneSizing = useAppStore((state) =>
    selectOpenDrawer(state) === null ? null : selectDrawerSizing(state),
  );
  return shellFoldsOf({
    paneSizing,
    columnWidth: context?.columnWidth ?? null,
    drawerWidth: context?.savedWidth ?? RIGHT_DRAWER_DEFAULT,
    railWidth,
    toolsWidth,
  });
};
