import { drawerKey } from '../../store/slices/drawer/drawerKey';
import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { HistoryVersionsDrawer } from './components/HistoryVersionsDrawer';

export const historyVersionsDrawerRegistration: DrawerRegistration<'history-versions'> = {
  kind: 'history-versions',
  render: ({ drawer, closeDrawer }) => (
    <HistoryVersionsDrawer
      key={drawerKey(drawer)}
      sessionId={drawer.sessionId}
      mountId={drawer.payload.mountId}
      worktreePath={drawer.payload.worktreePath}
      onClose={closeDrawer}
    />
  ),
};
