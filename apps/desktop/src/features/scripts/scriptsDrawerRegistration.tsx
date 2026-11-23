import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { LazySessionScriptsDrawer } from './components/LazySessionScriptsDrawer';

export const scriptsDrawerRegistration: DrawerRegistration<'scripts'> = {
  kind: 'scripts',
  render: ({ drawer, closeDrawer }) => (
    <LazySessionScriptsDrawer
      key={drawer.sessionId}
      sessionId={drawer.sessionId}
      onClose={closeDrawer}
    />
  ),
};
