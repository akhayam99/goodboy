import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../cn';
import { useDropdown } from '../useDropdown';
import { AnchoredPopover } from './AnchoredPopover';
import { Button } from './Button';
import { MenuItems, type OverflowMenuItem } from './MenuItems';
import { Tooltip } from './Tooltip';

export type SplitButtonPrimaryParams = {
  readonly className: string;
};

type Props = {
  readonly primary: (params: SplitButtonPrimaryParams) => ReactNode;
  readonly menuLabel: string;
  readonly items: ReadonlyArray<OverflowMenuItem>;
  readonly className?: string;
};

const PRIMARY_CLASS = 'rounded-r-none';

export const SplitButton = ({ primary, menuLabel, items, className }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-72',
    expectedHeight: 56 * items.length + 8,
    expectedWidth: 288,
  });

  return (
    <div className={cn('inline-flex min-w-0 items-stretch', className)}>
      {primary({ className: PRIMARY_CLASS })}
      <AnchoredPopover
        dropdown={dropdown}
        role="menu"
        ariaLabel={menuLabel}
        className="py-1"
        anchorClassName="flex shrink-0"
        trigger={
          <Tooltip content={menuLabel} anchorClassName="flex">
            <Button
              variant="primary"
              size="sm"
              onClick={dropdown.toggle}
              aria-label={menuLabel}
              aria-haspopup="menu"
              aria-expanded={dropdown.open}
              className="rounded-l-none border-l-on-tone/25 px-1.5"
            >
              <ChevronDown
                size={12}
                aria-hidden
                className={cn(
                  'shrink-0 motion-safe:transition-transform',
                  dropdown.open && 'rotate-180',
                )}
              />
            </Button>
          </Tooltip>
        }
      >
        <MenuItems items={items} onClose={dropdown.close} />
      </AnchoredPopover>
    </div>
  );
};
