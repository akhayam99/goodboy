import { useAppStore } from '../../../store';
import { selectDrawerPanel } from '../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerSizing } from '../../../store/slices/drawer/selectDrawerSizing';
import { shellFoldsOf, type ShellFolds } from '../../shellArrangement/shellFoldsOf';

export const useShellFolds = (): ShellFolds => {
  const paneSizing = useAppStore((state) =>
    selectDrawerPanel(state) === null ? null : selectDrawerSizing(state),
  );
  return shellFoldsOf({ paneSizing });
};
