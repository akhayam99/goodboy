import { cn } from '../../cn';
import type { TrailSegmentModel } from './types';
import { TRAIL_CRUMB_CLASS, TRAIL_CURRENT_CLASS, TRAIL_LINK_CLASS } from './trailClasses';

type Props = {
  readonly segment: TrailSegmentModel;
  readonly isCurrent: boolean;
};

export const TrailCrumb = ({ segment, isCurrent }: Props) => {
  const Icon = segment.icon;
  const content = (
    <>
      {Icon == null ? null : (
        <Icon
          size={12}
          aria-hidden
          className={cn('shrink-0', segment.iconClassName ?? 'text-faint-foreground')}
        />
      )}
      <span aria-current={isCurrent ? 'page' : undefined} className="min-w-0 truncate">
        {segment.label}
      </span>
      {segment.accessory}
    </>
  );

  if (segment.onSelect != null && !isCurrent) {
    return (
      <button
        type="button"
        onClick={segment.onSelect}
        className={cn(TRAIL_CRUMB_CLASS, TRAIL_LINK_CLASS, 'max-w-64')}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={cn(TRAIL_CRUMB_CLASS, isCurrent ? TRAIL_CURRENT_CLASS : TRAIL_LINK_CLASS)}>
      {content}
    </span>
  );
};
