import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { LazySessionScriptsDrawer } from './components/LazySessionScriptsDrawer';
import { WorkspaceScriptsHost } from './components/WorkspaceScriptsHost';

export const scriptsDrawerRegistration: DrawerRegistration<'scripts'> = {
  kind: 'scripts',
  render: ({ drawer, closeDrawer }) =>
    drawer.sessionId === null ? (
      <WorkspaceScriptsHost projectId={drawer.payload?.projectId ?? null} onClose={closeDrawer} />
    ) : (
      <LazySessionScriptsDrawer
        key={drawer.sessionId}
        sessionId={drawer.sessionId}
        onClose={closeDrawer}
      />
    ),
};
