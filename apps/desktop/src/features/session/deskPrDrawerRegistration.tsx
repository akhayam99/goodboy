import { drawerKey } from '../../store/slices/drawer/drawerKey';
import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { DeskPr } from './components/DeskPr';

export const deskPrDrawerRegistration: DrawerRegistration<'pull-request'> = {
  kind: 'pull-request',
  render: ({ drawer, closeDrawer }) => (
    <DeskPr
      key={drawerKey(drawer)}
      sessionId={drawer.sessionId}
      mountId={drawer.payload.mountId}
      tab={drawer.payload.tab}
      check={drawer.payload.check ?? null}
      onClose={closeDrawer}
    />
  ),
};
