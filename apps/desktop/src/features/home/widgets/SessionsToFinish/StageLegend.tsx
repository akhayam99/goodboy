import { cn, tintClasses } from '@goodboy/ui';
import type { Segment } from './segmentsOf';

type Props = {
  readonly segments: ReadonlyArray<Segment>;
};

export const StageLegend = ({ segments }: Props) => (
  <ul className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-meta text-muted-foreground">
    {segments
      .filter((segment) => segment.count > 0)
      .map((segment) => (
        <li key={segment.key} className="flex items-center gap-1 tabular-nums">
          <span
            aria-hidden
            className={cn('size-1.5 rounded-full', tintClasses(segment.tone).dot)}
          />
          {segment.count} {segment.label}
        </li>
      ))}
  </ul>
);
