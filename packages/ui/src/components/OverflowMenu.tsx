import type { ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';
import { AnchoredPopover } from './AnchoredPopover';
import { MenuTriggerButton, type MenuTriggerSize } from './MenuTriggerButton';
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
    width: 'min-w-[180px]',
    expectedHeight: 220,
  });

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
          {trigger ?? <MoreVertical size={size === 'control' ? 14 : 13} aria-hidden />}
        </MenuTriggerButton>
      }
    >
      <MenuItems items={items} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
