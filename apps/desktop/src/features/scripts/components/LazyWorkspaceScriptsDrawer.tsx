import { Suspense } from 'react';
import type { ComponentProps } from 'react';
import { lazyNamed } from '../../../shared/lib/lazyNamed';

const Drawer = lazyNamed({
  load: () => import('./WorkspaceScriptsDrawer'),
  pick: ({ WorkspaceScriptsDrawer }) => WorkspaceScriptsDrawer,
});

type Props = ComponentProps<typeof Drawer>;

export const LazyWorkspaceScriptsDrawer = ({ workspaceId, projectId, onClose }: Props) => (
  <Suspense
    fallback={
      <p role="status" className="px-4 py-3 text-meta text-muted-foreground">
        Opening the scripts
      </p>
    }
  >
    <Drawer workspaceId={workspaceId} projectId={projectId} onClose={onClose} />
  </Suspense>
);
