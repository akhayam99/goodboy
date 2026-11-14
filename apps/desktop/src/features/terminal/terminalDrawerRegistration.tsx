import { drawerKey } from '../../store/slices/drawer/drawerKey';
import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { LazyTerminalDrawer } from './components/LazyTerminalDrawer';

export const terminalDrawerRegistration: DrawerRegistration<'terminal'> = {
  kind: 'terminal',
  render: ({ drawer, closeDrawer }) => (
    <LazyTerminalDrawer
      key={drawerKey(drawer)}
      sessionId={drawer.sessionId}
      terminalId={drawer.payload.terminalId}
      onClose={closeDrawer}
    />
  ),
};
