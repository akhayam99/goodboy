import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { BrowserPane } from './components/BrowserPane';

export const browserDrawerRegistration: DrawerRegistration<'browser'> = {
  kind: 'browser',
  render: ({ drawer, closeDrawer }) => (
    <BrowserPane key={drawer.sessionId} sessionId={drawer.sessionId} onClose={closeDrawer} />
  ),
};
