import { ListGrid, ListGridRow, Skeleton } from '@goodboy/ui';
import { ARTIFACTS_GRID_COLUMNS } from './artifactsGridColumns';

const ROWS = [0, 1, 2] as const;

export const ArtifactListSkeleton = () => (
  <div role="status" aria-label="Loading artifacts" className="min-w-0">
    <ListGrid label="Artifacts" columns={ARTIFACTS_GRID_COLUMNS}>
      {ROWS.map((index) => (
        <ListGridRow
          key={index}
          cells={{
            byKey: {
              state: <Skeleton className="size-2 rounded-full" />,
              shape: <Skeleton className="h-4 w-4 rounded-sm" />,
              title: <Skeleton className="h-3 w-1/2 rounded-sm" />,
              word: <Skeleton className="h-3 w-16 rounded-sm" />,
              age: <Skeleton className="h-3 w-8 rounded-sm" />,
            },
          }}
        />
      ))}
    </ListGrid>
  </div>
);
