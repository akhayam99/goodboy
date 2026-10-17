import type { ReactElement } from 'react';
import { Skeleton, SkeletonText } from '@goodboy/ui';
import type { StudioSkeletonShape } from './studioMeta';

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7];
const BLOCKS = [0, 1, 2];
const CARDS = [0, 1, 2, 3];
const TABS = [0, 1, 2];

export const STUDIO_SKELETON_BODIES: Readonly<Record<StudioSkeletonShape, ReactElement>> = {
  rows: (
    <div className="flex flex-col gap-1">
      {ROWS.map((row) => (
        <div key={row} className="flex min-h-8 min-w-0 items-center gap-3 px-2">
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-1/2 rounded-sm" />
          <span className="flex-1" />
          <Skeleton className="h-3 w-16 rounded-sm" />
        </div>
      ))}
    </div>
  ),
  prose: (
    <div className="flex flex-col gap-6">
      {BLOCKS.map((block) => (
        <div key={block} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-1/3" />
          <SkeletonText lines={3} />
        </div>
      ))}
    </div>
  ),
  room: (
    <div className="flex flex-col gap-6">
      {BLOCKS.map((block) => (
        <SkeletonText key={block} lines={2} />
      ))}
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  ),
  terminal: (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {TABS.map((tab) => (
          <Skeleton key={tab} className="h-6 w-20 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-md" />
    </div>
  ),
  cards: (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {CARDS.map((card) => (
        <Skeleton key={card} className="h-20 rounded-lg" />
      ))}
    </div>
  ),
};
