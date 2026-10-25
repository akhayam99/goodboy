import { drawerKey } from '../../store/slices/drawer/drawerKey';
import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { FileDiffDrawer } from './components/FileDiffDrawer';
import { FileWholeDrawer } from './components/FileWholeDrawer';

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
      <FileDiffDrawer
        key={drawerKey(drawer)}
        sessionId={drawer.sessionId}
        source={drawer.payload.source}
        path={drawer.payload.path}
        onClose={closeDrawer}
      />
    );
  },
};
