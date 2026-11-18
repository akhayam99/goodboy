import { Suspense } from 'react';
import type { DrawerRegistration } from '../../../store/slices/drawer/drawerRegistration';
import { lazyNamed } from '../../../shared/lib/lazyNamed';

const AskDrawer = lazyNamed({
  load: () => import('./components/AskDrawer'),
  pick: ({ AskDrawer }) => AskDrawer,
});

export const askDrawerRegistration: DrawerRegistration<'ask'> = {
  kind: 'ask',
  render: ({ drawer, closeDrawer }) => (
    <Suspense fallback={null}>
      <AskDrawer sessionId={drawer.sessionId} onClose={closeDrawer} />
    </Suspense>
  ),
};
