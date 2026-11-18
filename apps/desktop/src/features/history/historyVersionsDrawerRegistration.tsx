import { Suspense } from 'react';
import { drawerKey } from '../../store/slices/drawer/drawerKey';
import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { lazyNamed } from '../../shared/lib/lazyNamed';

const HistoryVersionsDrawer = lazyNamed({
  load: () => import('./components/HistoryVersionsDrawer'),
  pick: ({ HistoryVersionsDrawer }) => HistoryVersionsDrawer,
});

export const historyVersionsDrawerRegistration: DrawerRegistration<'history-versions'> = {
  kind: 'history-versions',
  render: ({ drawer, closeDrawer }) => (
    <Suspense key={drawerKey(drawer)} fallback={null}>
      <HistoryVersionsDrawer
        sessionId={drawer.sessionId}
        mountId={drawer.payload.mountId}
        worktreePath={drawer.payload.worktreePath}
        onClose={closeDrawer}
      />
    </Suspense>
  ),
};
