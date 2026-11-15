import { Suspense } from 'react';
import type { ComponentProps } from 'react';
import { lazyNamed } from '../../../shared/lib/lazyNamed';

const Drawer = lazyNamed({
  load: () => import('./SessionScriptsDrawer'),
  pick: ({ SessionScriptsDrawer }) => SessionScriptsDrawer,
});

type Props = ComponentProps<typeof Drawer>;

export const LazySessionScriptsDrawer = ({ sessionId, onClose }: Props) => (
  <Suspense
    fallback={
      <p role="status" className="px-4 py-3 text-meta text-muted-foreground">
        Opening the scripts
      </p>
    }
  >
    <Drawer sessionId={sessionId} onClose={onClose} />
  </Suspense>
);
