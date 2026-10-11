import { Star } from 'lucide-react';
import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';
import { ICON_SIZE } from '../../iconSize';
import { Tooltip } from '../Tooltip';

type Props = {
  readonly isStarred: boolean;
  readonly label: string;
  readonly tooltip: string;
  readonly disabled?: boolean;
  readonly isQuietAtRest?: boolean;
  readonly className?: string;
  readonly onToggle: () => void;
};

export const StarToggle = ({
  isStarred,
  label,
  tooltip,
  disabled,
  isQuietAtRest = false,
  className,
  onToggle,
}: Props) => (
  <Tooltip content={tooltip} anchorClassName="shrink-0">
    <button
      type="button"
      aria-label={label}
      aria-pressed={isStarred}
      data-quiet-at-rest={isQuietAtRest && !isStarred ? 'true' : undefined}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-md hover:bg-hover disabled:opacity-50',
        isStarred ? 'text-warning' : 'text-faint-foreground hover:text-foreground',
        isQuietAtRest &&
          !isStarred &&
          'opacity-0 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100',
        FOCUS_RING,
        className,
      )}
    >
      <Star
        size={ICON_SIZE.row}
        aria-hidden
        className={cn('motion-safe:transition-transform', isStarred && 'fill-current')}
      />
    </button>
  </Tooltip>
);
