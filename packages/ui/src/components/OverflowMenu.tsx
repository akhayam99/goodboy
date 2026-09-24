import type { ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '../cn';
import { AnchoredPopover } from './AnchoredPopover';
import { Tooltip } from './Tooltip';
import { useDropdown } from '../useDropdown';
import { MenuItems, type OverflowMenuItem } from './MenuItems';

type OverflowMenuProps = {
  readonly items: ReadonlyArray<OverflowMenuItem>;
  readonly label?: string;
  readonly tooltip?: string;
  readonly triggerClassName?: string;
  readonly trigger?: ReactNode;
  readonly disabled?: boolean;
  readonly align?: 'left' | 'right';
};

export const OverflowMenu = ({
  items,
  label = 'More actions',
  tooltip,
  triggerClassName,
  trigger,
  disabled,
  align = 'right',
}: OverflowMenuProps) => {
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
        <Tooltip content={tooltip ?? label} anchorClassName="shrink-0">
          <button
            type="button"
            onClick={dropdown.toggle}
            disabled={disabled}
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={dropdown.open}
            className={cn(
              'shrink-0 rounded-sm p-1 motion-safe:transition-colors',
              disabled
                ? 'cursor-not-allowed text-faint-foreground'
                : 'text-faint-foreground hover:bg-hover hover:text-foreground',
              dropdown.open && 'bg-selected text-foreground',
              triggerClassName,
            )}
          >
            {trigger ?? <MoreVertical size={13} aria-hidden />}
          </button>
        </Tooltip>
      }
    >
      <MenuItems items={items} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
