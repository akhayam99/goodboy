import { cn, tintClasses } from '@goodboy/ui';
import type { Segment } from './segmentsOf';

type Props = {
  readonly segments: ReadonlyArray<Segment>;
};

export const StageBar = ({ segments }: Props) => (
  <span
    aria-hidden
    className="flex h-1 w-full min-w-0 shrink-0 gap-0.5 overflow-hidden rounded-full"
  >
    {segments
      .filter((segment) => segment.count > 0)
      .map((segment) => (
        <span
          key={segment.key}
          className={cn('h-full min-w-1 rounded-full', tintClasses(segment.tone).solid)}
          style={{ flexGrow: segment.count, flexBasis: 0 }}
        />
      ))}
  </span>
);
