import { drawerKey } from '../../store/slices/drawer/drawerKey';
import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { TerminalDrawer } from './components/TerminalDrawer';

export const terminalDrawerRegistration: DrawerRegistration<'terminal'> = {
  kind: 'terminal',
  render: ({ drawer, closeDrawer }) => (
    <TerminalDrawer
      key={drawerKey(drawer)}
      sessionId={drawer.sessionId}
      terminalId={drawer.payload.terminalId}
      onClose={closeDrawer}
    />
  ),
};
