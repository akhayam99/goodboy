import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../cn';
import { useDropdown } from '../../useDropdown';
import { AnchoredPopover } from '../AnchoredPopover';
import { Tooltip } from '../Tooltip';
import type { CrumbMenuModel } from './crumbMenuTypes';
import type { TrailSegmentModel } from './types';
import { CrumbMenu } from './CrumbMenu';
import { TrailLabel } from './TrailLabel';
import {
  TRAIL_CRUMB_CLASS,
  TRAIL_CURRENT_CLASS,
  TRAIL_LINK_CLASS,
  TRAIL_TAIL_CLASS,
} from './trailClasses';
import { ICON_SIZE } from '../../iconSize';

const WIDTH: Record<CrumbMenuModel['width'], { readonly className: string; readonly px: number }> =
  {
    narrow: { className: 'w-80', px: 320 },
    regular: { className: 'w-95', px: 380 },
    wide: { className: 'w-115', px: 460 },
  };

type Props = {
  readonly segment: TrailSegmentModel;
  readonly menu: CrumbMenuModel;
  readonly isCurrent: boolean;
  readonly isIconOnly: boolean;
};

export const CrumbMenuTrigger = ({ segment, menu, isCurrent, isIconOnly }: Props) => {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const width = WIDTH[menu.width];
  const dropdown = useDropdown({
    align: 'start',
    expectedHeight: 420,
    expectedWidth: width.px,
    width: cn(width.className, 'max-w-[calc(100vw-2rem)]'),
    isEscapeEnabled: confirmingId == null,
  });
  const { open, close, toggle } = dropdown;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    setConfirmingId(null);
    if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  const Icon = segment.icon;
  const iconNode =
    segment.glyph != null ? (
      <span aria-hidden className="flex shrink-0">
        {segment.glyph}
      </span>
    ) : (
      <Icon
        size={ICON_SIZE.row}
        aria-hidden
        className={cn('shrink-0', segment.iconClassName ?? 'text-faint-foreground')}
      />
    );
  const chevron = (
    <ChevronDown
      size={ICON_SIZE.row}
      aria-hidden
      className={cn('shrink-0 transition-transform', open && 'rotate-180')}
    />
  );
  const nameClass = cn(
    TRAIL_CRUMB_CLASS,
    'text-faint-foreground group-hover/crumb:text-foreground focus-visible:text-foreground',
    open && 'text-foreground',
  );
  const openOnArrow = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' || open) {
      return;
    }
    event.preventDefault();
    toggle();
  };

  const trigger = isCurrent ? (
    <Tooltip content={menu.triggerLabel} anchorClassName="flex min-w-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        onKeyDown={openOnArrow}
        aria-haspopup="menu"
        aria-expanded={open}
        data-crumb-trigger={segment.id}
        data-trail-piece=""
        className={cn(
          TRAIL_CRUMB_CLASS,
          TRAIL_CURRENT_CLASS,
          'gap-1',
          open && 'bg-overlay-selected',
        )}
      >
        {iconNode}
        <TrailLabel label={segment.label} isCurrent isIconOnly={false} />
        {segment.accessory != null ? (
          <span className="flex shrink-0 items-center pl-2">{segment.accessory}</span>
        ) : null}
        <span className="flex shrink-0 text-faint-foreground">{chevron}</span>
      </button>
    </Tooltip>
  ) : (
    <span
      className={cn(
        'group/crumb flex min-w-0 items-center rounded-sm transition-colors duration-120 ease-out hover:bg-hover',
        open && 'bg-hover',
      )}
    >
      {segment.onSelect != null ? (
        <button
          type="button"
          data-trail-piece=""
          onClick={segment.onSelect}
          aria-label={isIconOnly ? segment.label : undefined}
          className={nameClass}
        >
          {iconNode}
          <TrailLabel label={segment.label} isCurrent={false} isIconOnly={isIconOnly} />
        </button>
      ) : (
        <span data-trail-piece="" className={nameClass}>
          {iconNode}
          <TrailLabel label={segment.label} isCurrent={false} isIconOnly={isIconOnly} />
        </span>
      )}
      <Tooltip content={menu.triggerLabel} anchorClassName="flex shrink-0">
        <button
          ref={triggerRef}
          type="button"
          data-trail-tail=""
          onClick={toggle}
          onKeyDown={openOnArrow}
          aria-label={`${menu.triggerLabel}: ${segment.label}`}
          aria-haspopup="menu"
          aria-expanded={open}
          data-crumb-trigger={segment.id}
          className={cn(
            TRAIL_TAIL_CLASS,
            'group-hover/crumb:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            open && 'text-foreground',
          )}
        >
          <ChevronRight
            size={ICON_SIZE.row}
            aria-hidden
            className={cn(
              'shrink-0 motion-safe:transition-transform motion-safe:duration-150',
              open && 'rotate-90',
            )}
          />
        </button>
      </Tooltip>
    </span>
  );

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={menu.triggerLabel}
      anchorClassName="flex min-w-0 items-center"
      trigger={trigger}
    >
      <CrumbMenu
        model={menu}
        confirmingId={confirmingId}
        onConfirmingChange={setConfirmingId}
        onClose={close}
      />
    </AnchoredPopover>
  );
};
