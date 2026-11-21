import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { LazyMonitoringDrawer } from './components/MonitoringStudio/LazyMonitoringDrawer';

export const monitoringDrawerRegistration: DrawerRegistration<'monitoring'> = {
  kind: 'monitoring',
  render: ({ closeDrawer }) => <LazyMonitoringDrawer onClose={closeDrawer} />,
};
