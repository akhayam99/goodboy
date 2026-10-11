import { useEffect, type ReactNode } from 'react';
import { Ellipsis } from 'lucide-react';
import { AnchoredPopover } from './AnchoredPopover';
import { MenuTriggerButton, type MenuTriggerSize } from './MenuTriggerButton';
import { isProduction } from '../isProduction';
import { useDropdown } from '../useDropdown';
import { MenuItems, type OverflowMenuItem } from './MenuItems';

type Props = {
  readonly items: ReadonlyArray<OverflowMenuItem>;
  readonly label?: string;
  readonly tooltip?: string;
  readonly triggerClassName?: string;
  readonly trigger?: ReactNode;
  readonly disabled?: boolean;
  readonly align?: 'left' | 'right';
  readonly size?: MenuTriggerSize;
};

const MIN_DRAWN_ITEMS = 2;

export const OverflowMenu = ({
  items,
  label = 'More actions',
  tooltip,
  triggerClassName,
  trigger,
  disabled,
  align = 'right',
  size = 'compact',
}: Props) => {
  const dropdown = useDropdown({
    disabled,
    align: align === 'right' ? 'end' : 'start',
    width: 'min-w-50',
    expectedHeight: 220,
  });
  const drawn = items.filter((item) => item.kind === 'item').length;
  const isTooShort = drawn < MIN_DRAWN_ITEMS;

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
      role="menu"
      ariaLabel={label}
      className="py-1"
      trigger={
        <MenuTriggerButton
          label={label}
          tooltip={tooltip}
          isOpen={dropdown.open}
          size={size}
          disabled={disabled}
          className={triggerClassName}
          onClick={dropdown.toggle}
        >
          {trigger ?? <Ellipsis size={size === 'control' ? 14 : 12} aria-hidden />}
        </MenuTriggerButton>
      }
    >
      <MenuItems items={items} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
