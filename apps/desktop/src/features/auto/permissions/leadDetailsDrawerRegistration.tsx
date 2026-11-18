import { Suspense } from 'react';
import type { DrawerRegistration } from '../../../store/slices/drawer/drawerRegistration';
import { lazyNamed } from '../../../shared/lib/lazyNamed';

const LeadDetailsDrawer = lazyNamed({
  load: () => import('./LeadDetailsDrawer'),
  pick: ({ LeadDetailsDrawer }) => LeadDetailsDrawer,
});

export const leadDetailsDrawerRegistration: DrawerRegistration<'lead-details'> = {
  kind: 'lead-details',
  render: ({ drawer, closeDrawer }) => (
    <Suspense key={drawer.payload.treeId} fallback={null}>
      <LeadDetailsDrawer
        sessionId={drawer.sessionId}
        workspaceId={drawer.payload.workspaceId}
        treeId={drawer.payload.treeId}
        onClose={closeDrawer}
      />
    </Suspense>
  ),
};
