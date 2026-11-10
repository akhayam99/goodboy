import type { DestinationId } from '../../shared/navigation/destinations';
import { openDestination } from '../../shared/navigation/openDestination';
import { toggleBrowserDock } from '../browser/toggleBrowserDock';
import { toggleTerminalDock } from '../terminal/toggleTerminalDock';

type Params = {
  readonly id: DestinationId;
};

export const runDestination = ({ id }: Params): void => {
  if (id === 'terminal') {
    toggleTerminalDock({ isToggle: false });
    return;
  }
  if (id === 'browser') {
    toggleBrowserDock({ isToggle: false });
    return;
  }
  openDestination({ id });
};
