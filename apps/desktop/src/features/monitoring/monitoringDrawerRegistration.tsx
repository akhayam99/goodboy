import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { MonitoringDrawer } from './components/MonitoringStudio/MonitoringDrawer';

export const monitoringDrawerRegistration: DrawerRegistration<'monitoring'> = {
  kind: 'monitoring',
  render: ({ closeDrawer }) => <MonitoringDrawer onClose={closeDrawer} />,
};
