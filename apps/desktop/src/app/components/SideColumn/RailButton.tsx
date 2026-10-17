import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip, cn } from '@goodboy/ui';
import type { ShortcutId } from '../../../shared/keyboard/registry';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';

type Props = {
  readonly id: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly shortcut?: ShortcutId;
  readonly isCurrent: boolean;
  readonly className?: string;
  readonly badge?: ReactNode;
  readonly isPage?: boolean;
  readonly iconSize?: number;
  readonly iconClassName?: string;
  readonly isIconSlotted?: boolean;
  readonly onSelect: () => void;
};

const RAIL_BUTTON_BASE =
  'relative flex shrink-0 items-center rounded-md motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

const RAIL_BUTTON_CURRENT = 'cursor-default bg-selected text-foreground';

export const RAIL_NODE_CURRENT = cn(RAIL_BUTTON_CURRENT, 'ring-1 ring-inset ring-border');

export const RAIL_BUTTON_IDLE = 'text-muted-foreground hover:bg-hover hover:text-foreground';

export const RAIL_NODE_BUTTON = cn('size-7 justify-center', RAIL_BUTTON_BASE);

const RAIL_BUTTON = cn('h-7 w-full justify-start px-2', RAIL_BUTTON_BASE);

export const RailButton = ({
  id,
  icon: Icon,
  label,
  shortcut,
  isCurrent,
  className,
  badge,
  isPage = false,
  iconSize = ICON_SIZE.control,
  iconClassName,
  isIconSlotted = false,
  onSelect,
}: Props) => (
  <Tooltip content={label} shortcut={shortcut} side="right">
    <button
      type="button"
      data-column-door={isPage ? undefined : id}
      data-rail-page={isPage ? id : undefined}
      aria-label={label}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={() => {
        if (isCurrent) {
          return;
        }
        onSelect();
      }}
      className={cn(RAIL_BUTTON, isCurrent ? RAIL_BUTTON_CURRENT : RAIL_BUTTON_IDLE, className)}
    >
      {isIconSlotted ? (
        <span className="flex size-4 shrink-0 items-center justify-center">
          <Icon size={iconSize} aria-hidden className={iconClassName} />
        </span>
      ) : (
        <Icon size={iconSize} aria-hidden className={cn('shrink-0', iconClassName)} />
      )}
      {badge}
    </button>
  </Tooltip>
);
