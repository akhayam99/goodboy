import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { LazyBrowserPane } from './components/LazyBrowserPane';
import { WorkspaceBrowserDock } from './components/WorkspaceBrowserDock';

export const browserDrawerRegistration: DrawerRegistration<'browser'> = {
  kind: 'browser',
  render: ({ drawer, closeDrawer }) =>
    drawer.sessionId === null ? (
      <WorkspaceBrowserDock onClose={closeDrawer} />
    ) : (
      <LazyBrowserPane key={drawer.sessionId} sessionId={drawer.sessionId} onClose={closeDrawer} />
    ),
};
