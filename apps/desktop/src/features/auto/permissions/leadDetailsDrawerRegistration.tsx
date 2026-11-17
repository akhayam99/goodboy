import type { DrawerRegistration } from '../../../store/slices/drawer/drawerRegistration';
import { LeadDetailsDrawer } from './LeadDetailsDrawer';

export const leadDetailsDrawerRegistration: DrawerRegistration<'lead-details'> = {
  kind: 'lead-details',
  render: ({ drawer, closeDrawer }) => (
    <LeadDetailsDrawer
      key={drawer.payload.treeId}
      sessionId={drawer.sessionId}
      workspaceId={drawer.payload.workspaceId}
      treeId={drawer.payload.treeId}
      onClose={closeDrawer}
    />
  ),
};
