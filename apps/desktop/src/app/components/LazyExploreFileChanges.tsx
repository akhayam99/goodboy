import { Suspense } from 'react';
import { Skeleton } from '@goodboy/ui';
import { lazyNamed } from '../../shared/lib/lazyNamed';

const Changes = lazyNamed({
  load: () => import('./ExploreFileChanges'),
  pick: ({ ExploreFileChanges }) => ExploreFileChanges,
});

type Props = {
  readonly sessionDir: string;
  readonly relPath: string;
  readonly baseBranch: string | null;
};

export const LazyExploreFileChanges = ({ sessionDir, relPath, baseBranch }: Props) => (
  <Suspense
    fallback={
      <div role="status" className="flex flex-col gap-2 p-3" aria-label="Loading changes">
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-3 w-3/4 rounded-sm" />
        <Skeleton className="h-3 w-1/2 rounded-sm" />
      </div>
    }
  >
    <Changes sessionDir={sessionDir} relPath={relPath} baseBranch={baseBranch} />
  </Suspense>
);
