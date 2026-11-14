import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly start: ReactNode;
  readonly end: ReactNode;
  readonly isRow: boolean;
};

export const ToolbarRow = ({ start, end, isRow }: Props) => (
  <div
    data-slot="diff-toolbar"
    data-grid-row={isRow ? '1' : undefined}
    className={cn(
      'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2',
      isRow && 'h-10 shrink-0 pl-4 pr-6',
    )}
  >
    <div className={cn('flex min-w-0 items-center gap-2', isRow && 'overflow-x-clip')}>{start}</div>
    <div className="flex shrink-0 items-center gap-2">{end}</div>
  </div>
);
