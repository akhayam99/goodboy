import { Suspense } from 'react';
import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { lazyNamed } from '../../shared/lib/lazyNamed';

const PlanPartDrawer = lazyNamed({
  load: () => import('./components/PlanParts/PlanPartDrawer'),
  pick: ({ PlanPartDrawer }) => PlanPartDrawer,
});

export const planPartDrawerRegistration: DrawerRegistration<'plan-part'> = {
  kind: 'plan-part',
  render: ({ drawer, closeDrawer }) => (
    <Suspense fallback={null}>
      <PlanPartDrawer
        sessionId={drawer.sessionId}
        planId={drawer.payload.planId}
        index={drawer.payload.index}
        onClose={closeDrawer}
      />
    </Suspense>
  ),
};
