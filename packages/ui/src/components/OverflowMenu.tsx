import { useEffect, type ReactNode } from 'react';
import { Ellipsis } from 'lucide-react';
import { AnchoredPopover } from './AnchoredPopover';
import { MenuTriggerButton, type MenuTriggerSize } from './MenuTriggerButton';
import { ICON_SIZE } from '../iconSize';
import { MENU_MAX_WIDTH } from '../menuMaxWidth';
import { isProduction } from '../isProduction';
import { useDropdown } from '../useDropdown';
import { MenuList } from './ContextMenu/MenuList';
import type { MenuEntry } from './ContextMenu/menuTypes';

type Props = {
  readonly entries: ReadonlyArray<MenuEntry>;
  readonly label?: string;
  readonly triggerClassName?: string;
  readonly trigger?: ReactNode;
  readonly disabled?: boolean;
  readonly align?: 'left' | 'right';
  readonly size?: MenuTriggerSize;
  readonly onOpenChange?: (isOpen: boolean) => void;
};

const MIN_DRAWN_ITEMS = 2;

export const OverflowMenu = ({
  entries,
  label = 'More actions',
  triggerClassName,
  trigger,
  disabled,
  align = 'right',
  size = 'compact',
  onOpenChange,
}: Props) => {
  const dropdown = useDropdown({
    disabled,
    align: align === 'right' ? 'end' : 'start',
    width: 'min-w-50',
    maxWidth: MENU_MAX_WIDTH,
    expectedHeight: 220,
  });
  const drawn = entries.filter((entry) => entry.kind === 'item').length;
  const isTooShort = drawn < MIN_DRAWN_ITEMS;

  useEffect(() => {
    onOpenChange?.(dropdown.open);
  }, [dropdown.open, onOpenChange]);

  useEffect(() => {
    if (!isTooShort || isProduction()) {
      return;
    }
    console.error('OverflowMenu needs two items');
  }, [isTooShort]);

  if (isTooShort) {
    return null;
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      trigger={
        <MenuTriggerButton
          label={label}
          isOpen={dropdown.open}
          size={size}
          disabled={disabled}
          className={triggerClassName}
          onClick={dropdown.toggle}
        >
          {trigger ?? (
            <Ellipsis size={size === 'control' ? ICON_SIZE.control : ICON_SIZE.row} aria-hidden />
          )}
        </MenuTriggerButton>
      }
    >
      <MenuList label={label} entries={entries} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
