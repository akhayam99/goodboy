import { useAppStore } from '../../store';
import { toggleTerminalDock } from './toggleTerminalDock';

type Params = Record<never, never>;

export const dockEmptyTerminalPage = ({}: Params): void => {
  useAppStore.getState().closeStudio();
  toggleTerminalDock({ isToggle: false });
};
