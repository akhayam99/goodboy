import { PageColumn, Skeleton } from '@goodboy/ui';
import type { StudioSkeletonLayout } from './studioMeta';

const ROWS = [0, 1, 2, 3, 4, 5];
const CARDS = [0, 1, 2, 3, 4, 5];
const RAIL_ITEMS = [0, 1, 2, 3, 4];

const LIST_ROWS = (
  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
    <PageColumn className="flex flex-col gap-4 py-6">
      {ROWS.map((row) => (
        <div key={row} className="flex items-start gap-3">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </PageColumn>
  </div>
);

const railSkeleton = ({ widthPx }: { readonly widthPx: number }) => (
  <div
    data-studio-skeleton-rail=""
    style={{ width: widthPx }}
    className="flex shrink-0 flex-col gap-3 bg-subtle px-4 py-6"
  >
    {RAIL_ITEMS.map((item) => (
      <Skeleton key={item} className="h-3 w-3/4" />
    ))}
  </div>
);

const GRID = (
  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
    <PageColumn className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4 py-6">
      {CARDS.map((card) => (
        <div key={card} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </PageColumn>
  </div>
);

type Props = {
  readonly layout: StudioSkeletonLayout;
  readonly title: string;
  readonly railWidthPx: number;
};

export const StudioSkeleton = ({ layout, title, railWidthPx }: Props) => (
  <div
    role="status"
    aria-label={`Loading ${title}`}
    data-studio-skeleton={layout}
    className="flex min-h-0 min-w-0 flex-1 bg-background"
  >
    {layout === 'rail' ? railSkeleton({ widthPx: railWidthPx }) : null}
    {layout === 'grid' ? GRID : LIST_ROWS}
  </div>
);
