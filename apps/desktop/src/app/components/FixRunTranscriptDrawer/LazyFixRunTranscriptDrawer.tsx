import { Suspense } from 'react';
import type { ComponentProps } from 'react';
import { lazyNamed } from '../../../shared/lib/lazyNamed';

const Drawer = lazyNamed({
  load: () => import('./index'),
  pick: ({ FixRunTranscriptDrawer }) => FixRunTranscriptDrawer,
});

type Props = ComponentProps<typeof Drawer>;

export const LazyFixRunTranscriptDrawer = ({ sessionId, agentId, onClose }: Props) => (
  <Suspense
    fallback={
      <p role="status" className="px-4 py-3 text-meta text-muted-foreground">
        Opening the fix run
      </p>
    }
  >
    <Drawer sessionId={sessionId} agentId={agentId} onClose={onClose} />
  </Suspense>
);
