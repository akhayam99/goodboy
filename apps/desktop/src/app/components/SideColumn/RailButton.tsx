import type { FocusEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn, ICON_SIZE, PANE_RHYTHM, tintClasses, Tooltip, FOCUS_RING } from '@goodboy/ui';
import type { ShortcutId } from '../../../shared/keyboard/registry';

import { navEntryToneOf } from '../../../shared/components/navEntryToneOf';

export type RailButtonPopup = {
  readonly onEnter: (event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => void;
  readonly onLeave: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

type Props = {
  readonly id: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly mark?: string | null;
  readonly shortcut?: ShortcutId;
  readonly isCurrent: boolean;
  readonly className?: string;
  readonly badge?: ReactNode;
  readonly isPage?: boolean;
  readonly iconSize?: number;
  readonly iconClassName?: string;
  readonly isIconSlotted?: boolean;
  readonly popup?: RailButtonPopup;
  readonly onSelect: () => void;
};

const RAIL_BUTTON_BASE = cn(
  'relative flex shrink-0 items-center rounded-md motion-safe:transition-colors',
  FOCUS_RING,
);

const RAIL_BUTTON_CURRENT = 'cursor-default bg-selected text-foreground';

export const RAIL_NODE_CURRENT = cn(RAIL_BUTTON_CURRENT, 'ring-1 ring-inset ring-border');

export const RAIL_BUTTON_IDLE = 'text-muted-foreground hover:bg-hover hover:text-foreground';

export const RAIL_NODE_BUTTON = cn('size-7 justify-center', RAIL_BUTTON_BASE);

const RAIL_BUTTON = cn('h-7 w-full justify-start px-2', RAIL_BUTTON_BASE);

export const RailButton = ({
  id,
  icon: Icon,
  label,
  mark = null,
  shortcut,
  isCurrent,
  className,
  badge,
  isPage = false,
  iconSize = ICON_SIZE.control,
  iconClassName,
  isIconSlotted = false,
  popup,
  onSelect,
}: Props) => {
  const iconClass =
    iconClassName ?? (isCurrent ? tintClasses(navEntryToneOf({ icon: Icon })).icon : undefined);
  const button = (
    <button
      type="button"
      data-column-door={isPage ? undefined : id}
      data-rail-page={isPage ? id : undefined}
      aria-label={label}
      aria-current={isCurrent ? 'page' : undefined}
      aria-haspopup={popup === undefined ? undefined : 'dialog'}
      onMouseEnter={popup?.onEnter}
      onMouseLeave={popup?.onLeave}
      onFocus={popup?.onEnter}
      onBlur={popup?.onLeave}
      onKeyDown={popup?.onKeyDown}
      onClick={(event) => {
        if (popup !== undefined) {
          popup.onEnter(event);
          return;
        }
        if (isCurrent) {
          return;
        }
        onSelect();
      }}
      className={cn(
        RAIL_BUTTON,
        mark !== null && 'justify-center px-0',
        isCurrent ? RAIL_BUTTON_CURRENT : RAIL_BUTTON_IDLE,
        className,
      )}
    >
      {mark !== null ? (
        <span aria-hidden className="text-chip tabular-nums">
          {mark}
        </span>
      ) : isIconSlotted ? (
        <span data-nav-icon="" className={PANE_RHYTHM.navRail.icon}>
          <Icon size={iconSize} aria-hidden className={iconClass} />
        </span>
      ) : (
        <Icon size={iconSize} aria-hidden data-nav-icon="" className={cn('shrink-0', iconClass)} />
      )}
      {badge}
    </button>
  );
  if (popup !== undefined) {
    return button;
  }
  return (
    <Tooltip content={label} shortcut={shortcut} side="right">
      {button}
    </Tooltip>
  );
};
