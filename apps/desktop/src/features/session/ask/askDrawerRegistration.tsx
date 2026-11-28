import type { DrawerRegistration } from '../../../store/slices/drawer/drawerRegistration';
import { AskPane } from './components/AskPane';
import { WorkspaceAskHost } from './components/WorkspaceAskHost';

export const askDrawerRegistration: DrawerRegistration<'ask'> = {
  kind: 'ask',
  render: ({ drawer, closeDrawer }) =>
    drawer.sessionId === null ? (
      <WorkspaceAskHost onClose={closeDrawer} />
    ) : (
      <AskPane key={drawer.sessionId} sessionId={drawer.sessionId} onClose={closeDrawer} />
    ),
};
