import { Suspense } from 'react';
import type { ComponentProps } from 'react';
import { lazyNamed } from '../../../../shared/lib/lazyNamed';

const Drawer = lazyNamed({
  load: () => import('./index'),
  pick: ({ ArtifactDocumentDrawer }) => ArtifactDocumentDrawer,
});

type Props = ComponentProps<typeof Drawer>;

export const LazyArtifactDocumentDrawer = ({ sessionId, artifactId, revision, onClose }: Props) => (
  <Suspense
    fallback={
      <p role="status" className="px-4 py-3 text-meta text-muted-foreground">
        Opening the document
      </p>
    }
  >
    <Drawer sessionId={sessionId} artifactId={artifactId} revision={revision} onClose={onClose} />
  </Suspense>
);
