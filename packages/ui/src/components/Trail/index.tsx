import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../cn';
import type { TrailSegmentModel } from './types';
import { TrailCrumb } from './TrailCrumb';

type Props = {
  readonly segments: ReadonlyArray<TrailSegmentModel>;
  readonly lead?: ReactNode;
  readonly className?: string;
};

export const Trail = ({ segments, lead, className }: Props) => (
  <nav
    aria-label="Breadcrumb"
    data-slot="trail"
    className={cn('flex h-6 min-w-0 flex-1 items-center gap-1.5 overflow-hidden', className)}
  >
    {lead}
    {segments.map((segment, index) => {
      const isCurrent = index === segments.length - 1;
      return (
        <span
          key={segment.id}
          data-trail-segment={segment.id}
          className={cn(
            'flex min-w-0 items-center gap-1.5',
            isCurrent ? 'flex-1' : 'shrink',
            segment.className,
          )}
        >
          {index > 0 ? (
            <ChevronRight size={12} aria-hidden className="shrink-0 text-faint-foreground" />
          ) : null}
          {segment.render ?? <TrailCrumb segment={segment} isCurrent={isCurrent} />}
        </span>
      );
    })}
  </nav>
);
