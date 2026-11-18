import { Suspense } from 'react';
import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { lazyNamed } from '../../shared/lib/lazyNamed';

const CheckAnalysisDrawer = lazyNamed({
  load: () => import('./components/CheckAnalysisDrawer'),
  pick: ({ CheckAnalysisDrawer }) => CheckAnalysisDrawer,
});

export const checkAnalysisDrawerRegistration: DrawerRegistration<'check-analysis'> = {
  kind: 'check-analysis',
  render: ({ drawer, closeDrawer }) => (
    <Suspense fallback={null}>
      <CheckAnalysisDrawer
        sessionId={drawer.payload.sessionId}
        mountId={drawer.payload.mountId}
        checkUrl={drawer.payload.checkUrl}
        onClose={closeDrawer}
      />
    </Suspense>
  ),
};
