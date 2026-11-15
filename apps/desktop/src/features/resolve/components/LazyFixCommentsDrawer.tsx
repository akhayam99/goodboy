import { Suspense } from 'react';
import type { ComponentProps } from 'react';
import { lazyNamed } from '../../../shared/lib/lazyNamed';

const Drawer = lazyNamed({
  load: () => import('./FixCommentsDrawer'),
  pick: ({ FixCommentsDrawer }) => FixCommentsDrawer,
});

type Props = ComponentProps<typeof Drawer>;

export const LazyFixCommentsDrawer = ({
  sessionId,
  mountId,
  focusThreadId,
  threadIds,
  fromThreadId,
  onClose,
}: Props) => (
  <Suspense
    fallback={
      <p role="status" className="px-4 py-3 text-meta text-muted-foreground">
        Opening the comments
      </p>
    }
  >
    <Drawer
      sessionId={sessionId}
      mountId={mountId}
      focusThreadId={focusThreadId}
      threadIds={threadIds}
      fromThreadId={fromThreadId}
      onClose={onClose}
    />
  </Suspense>
);
