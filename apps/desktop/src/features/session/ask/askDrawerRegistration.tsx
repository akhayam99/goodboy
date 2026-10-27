import type { DrawerRegistration } from '../../../store/slices/drawer/drawerRegistration';
import { AskDrawer } from './components/AskDrawer';

export const askDrawerRegistration: DrawerRegistration<'ask'> = {
  kind: 'ask',
  render: ({ drawer, closeDrawer }) => (
    <AskDrawer sessionId={drawer.sessionId} onClose={closeDrawer} />
  ),
};
