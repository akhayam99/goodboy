import { Suspense } from 'react';
import { drawerKey } from '../../store/slices/drawer/drawerKey';
import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { lazyNamed } from '../../shared/lib/lazyNamed';
import { FileWholeDrawer } from './components/FileWholeDrawer';

const FileDiffDrawer = lazyNamed({
  load: () => import('./components/FileDiffDrawer'),
  pick: ({ FileDiffDrawer }) => FileDiffDrawer,
});

export const fileDiffDrawerRegistration: DrawerRegistration<'file-diff'> = {
  kind: 'file-diff',
  render: ({ drawer, closeDrawer }) => {
    if (drawer.payload.whole !== undefined && drawer.payload.source.kind === 'worktree') {
      return (
        <FileWholeDrawer
          key={drawerKey(drawer)}
          worktreePath={drawer.payload.source.worktreePath}
          whole={drawer.payload.whole}
          onClose={closeDrawer}
        />
      );
    }
    return (
      <Suspense key={drawerKey(drawer)} fallback={null}>
        <FileDiffDrawer
          sessionId={drawer.sessionId}
          source={drawer.payload.source}
          path={drawer.payload.path}
          onClose={closeDrawer}
        />
      </Suspense>
    );
  },
};
