import { useRef } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  AnchoredPopover,
  TOP_BAR_CONTROL,
  Tooltip,
  cn,
  useDropdown,
  type MenuEntry,
} from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { AppMenuList } from '../../../../features/actions/AppMenuList';
import type { HistoryItem } from './historyItem';
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
    expectedWidth: 320,
    width: 'w-80 max-w-[calc(100vw-2rem)]',
  });
  const { open, close, toggle } = dropdown;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHold = useRef(false);
  const isDisabled = target === null;
  const Icon = direction === 'back' ? ArrowLeft : ArrowRight;
  const verb = direction === 'back' ? 'Back' : 'Forward';
  const shortcut = direction === 'back' ? 'nav.back' : 'nav.forward';
  const tooltip = isDisabled
    ? direction === 'back'
      ? 'Nothing to go back to'
      : 'Nothing to go forward to'
    : `${verb} to ${target.label}${target.context === null ? '' : `\n${target.context}`}`;

  const clearHold = () => {
    if (holdTimer.current === null) {
      return;
    }
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const entries: ReadonlyArray<MenuEntry> = [
    {
      kind: 'radio',
      key: 'history',
      label: verb,
      choices: items.map((item) => ({
        id: String(item.index),
        label: item.label,
        isCurrent: item.isCurrent,
        hint: item.context,
      })),
      onSelect: (choice) => {
        const item = items.find((candidate) => String(candidate.index) === choice);
        if (item === undefined) {
          return;
        }
        onJump(item.index);
      },
    },
  ];

  const openMenu = () => {
    if (items.length === 0 || open) {
      return;
    }
    toggle();
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="flex shrink-0"
      trigger={
        <Tooltip content={tooltip} shortcut={isDisabled ? undefined : shortcut} side="bottom">
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
              TOP_BAR_CONTROL.square,
              TOP_BAR_CONTROL.radius,
              'flex shrink-0 items-center justify-center text-muted-foreground motion-safe:transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              isDisabled ? 'cursor-default opacity-40' : 'hover:bg-hover hover:text-foreground',
            )}
          >
            <Icon size={ICON_SIZE.control} aria-hidden />
          </button>
        </Tooltip>
      }
    >
      <AppMenuList label="History" entries={entries} onClose={close} />
    </AnchoredPopover>
  );
};
