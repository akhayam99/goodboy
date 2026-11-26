import type { DrawerRegistration } from '../../../store/slices/drawer/drawerRegistration';
import { AskPane } from './components/AskPane';

export const askDrawerRegistration: DrawerRegistration<'ask'> = {
  kind: 'ask',
  render: ({ drawer, closeDrawer }) => (
    <AskPane key={drawer.sessionId} sessionId={drawer.sessionId} onClose={closeDrawer} />
  ),
};
