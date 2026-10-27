import { Bell } from 'lucide-react';
import { cn, FOCUS_RING, ICON_SIZE, StatusDot, Tooltip, TOP_BAR_CONTROL } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';

const BELL_COUNT_CAP = 9;

type CountParams = {
  readonly count: number;
};

const bellCountLabel = ({ count }: CountParams): string =>
  count > BELL_COUNT_CAP ? `${BELL_COUNT_CAP}+` : String(count);

type Props = {
  readonly isOpen: boolean;
  readonly unread: number;
  readonly hasUnreadDebt: boolean;
  readonly onClick: () => void;
};

export const BellButton = ({ isOpen, unread, hasUnreadDebt, onClick }: Props) => (
  <Tooltip content={NAMES.notifications} side="top">
    <button
      type="button"
      onClick={onClick}
      className={cn(
        TOP_BAR_CONTROL.height,
        unread > 0 ? 'min-w-7 gap-1 px-1' : TOP_BAR_CONTROL.square,
        TOP_BAR_CONTROL.radius,
        FOCUS_RING,
        'flex shrink-0 items-center justify-center motion-safe:transition-colors',
        isOpen
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-hover',
      )}
      aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
    >
      <Bell size={ICON_SIZE.control} aria-hidden />
      {unread > 0 && (
        <span
          aria-hidden
          data-bell-dot={hasUnreadDebt ? 'warning' : 'unread'}
          className="flex items-center gap-0.5"
        >
          <span
            data-bell-count=""
            className={cn(
              'text-chip tabular-nums',
              hasUnreadDebt ? 'text-warning' : 'text-primary',
            )}
          >
            {bellCountLabel({ count: unread })}
          </span>
          <StatusDot tone={hasUnreadDebt ? 'warning' : 'primary'} size="sm" />
        </span>
      )}
    </button>
  </Tooltip>
);
