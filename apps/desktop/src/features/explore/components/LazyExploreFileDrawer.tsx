import { Suspense } from 'react';
import type { ComponentProps } from 'react';
import { lazyNamed } from '../../../shared/lib/lazyNamed';

const Drawer = lazyNamed({
  load: () => import('./ExploreFileDrawer'),
  pick: ({ ExploreFileDrawer }) => ExploreFileDrawer,
});

type Props = ComponentProps<typeof Drawer>;

export const LazyExploreFileDrawer = ({
  sessionId,
  sessionDir,
  entry,
  line,
  renderChanges,
  back,
  onClose,
}: Props) => (
  <Suspense
    fallback={
      <p role="status" className="px-4 py-3 text-meta text-muted-foreground">
        Opening the file
      </p>
    }
  >
    <Drawer
      sessionId={sessionId}
      sessionDir={sessionDir}
      entry={entry}
      {...(line !== undefined && { line })}
      renderChanges={renderChanges}
      {...(back !== undefined && { back })}
      onClose={onClose}
    />
  </Suspense>
);
