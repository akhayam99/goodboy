import { Skeleton, cn } from '@goodboy/ui';
import { ARTIFACT_ROW_GRID } from './artifactRowGrid';

const ROWS = [0, 1, 2] as const;

export const ArtifactListSkeleton = () => (
  <div role="status" aria-label="Loading artifacts" className="@container flex min-w-0 flex-col">
    {ROWS.map((index) => (
      <div key={index} data-testid="artifact-skeleton-row" className={ARTIFACT_ROW_GRID.frame}>
        <span aria-hidden className={ARTIFACT_ROW_GRID.lead} />
        <Skeleton className={cn(ARTIFACT_ROW_GRID.glyph, 'h-4 rounded-sm')} />
        <span className={ARTIFACT_ROW_GRID.title}>
          <Skeleton className="h-3 w-1/2 rounded-sm" />
        </span>
        <span className={ARTIFACT_ROW_GRID.state}>
          <Skeleton className="h-3 w-16 rounded-sm" />
        </span>
        <span className={cn(ARTIFACT_ROW_GRID.date, 'flex justify-end')}>
          <Skeleton className="h-3 w-10 rounded-sm" />
        </span>
      </div>
    ))}
  </div>
);
