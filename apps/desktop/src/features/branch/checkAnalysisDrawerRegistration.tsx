import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { CheckAnalysisDrawer } from './components/CheckAnalysisDrawer';

export const checkAnalysisDrawerRegistration: DrawerRegistration<'check-analysis'> = {
  kind: 'check-analysis',
  render: ({ drawer, closeDrawer }) => (
    <CheckAnalysisDrawer
      sessionId={drawer.payload.sessionId}
      mountId={drawer.payload.mountId}
      checkUrl={drawer.payload.checkUrl}
      onClose={closeDrawer}
    />
  ),
};
