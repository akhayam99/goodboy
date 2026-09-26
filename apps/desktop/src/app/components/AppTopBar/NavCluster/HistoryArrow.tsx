import { useRef } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { AnchoredPopover, Tooltip, cn, useDropdown } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { HistoryMenu, type HistoryItem } from './HistoryMenu';
import type { HistoryLabel } from './historyLabel';

const HOLD_MS = 400;

type Props = {
  readonly direction: 'back' | 'forward';
  readonly target: HistoryLabel | null;
  readonly items: ReadonlyArray<HistoryItem>;
  readonly onGo: () => void;
  readonly onJump: (index: number) => void;
};

export const HistoryArrow = ({ direction, target, items, onGo, onJump }: Props) => {
  const dropdown = useDropdown({
    align: direction === 'back' ? 'start' : 'center',
    expectedHeight: 30 * items.length + 8,
    expectedWidth: 280,
    width: 'w-70 max-w-[calc(100vw-2rem)]',
  });
  const { open, close, toggle } = dropdown;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHold = useRef(false);
  const isDisabled = target === null;
  const Icon = direction === 'back' ? ArrowLeft : ArrowRight;
  const verb = direction === 'back' ? 'Back' : 'Forward';
  const glyph = shortcutGlyphs(direction === 'back' ? 'nav.back' : 'nav.forward');
  const tooltip = isDisabled
    ? direction === 'back'
      ? 'Nothing to go back to'
      : 'Nothing to go forward to'
    : `${verb} to ${target.label}${target.context === null ? '' : ` · ${target.context}`}  ${glyph}`;

  const clearHold = () => {
    if (holdTimer.current === null) {
      return;
    }
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const openMenu = () => {
    if (items.length === 0 || open) {
      return;
    }
    toggle();
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="History"
      className="rounded-lg border border-border-soft bg-floating shadow-xl"
      anchorClassName="flex shrink-0"
      trigger={
        <Tooltip content={tooltip} side="bottom">
          <button
            type="button"
            aria-label={isDisabled ? verb : `${verb} to ${target.label}`}
            aria-disabled={isDisabled ? true : undefined}
            data-nav-arrow={direction}
            onClick={() => {
              if (didHold.current) {
                didHold.current = false;
                return;
              }
              if (!isDisabled) {
                onGo();
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              openMenu();
            }}
            onPointerDown={() => {
              didHold.current = false;
              clearHold();
              holdTimer.current = setTimeout(() => {
                didHold.current = true;
                openMenu();
              }, HOLD_MS);
            }}
            onPointerUp={clearHold}
            onPointerLeave={clearHold}
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              isDisabled ? 'cursor-default opacity-40' : 'hover:bg-hover hover:text-foreground',
            )}
          >
            <Icon size={ICON_SIZE.control} aria-hidden />
          </button>
        </Tooltip>
      }
    >
      <HistoryMenu
        items={items}
        onJump={(index) => {
          close();
          onJump(index);
        }}
      />
    </AnchoredPopover>
  );
};
