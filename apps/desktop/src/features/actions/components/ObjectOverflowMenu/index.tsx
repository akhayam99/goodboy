import type { ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';
import { AnchoredPopover, Tooltip, cn, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ObjectTarget } from '../../types';
import { ObjectOverflowList } from './ObjectOverflowList';

const NO_OMISSIONS: ReadonlyArray<string> = [];

type Props = {
  readonly target: ObjectTarget;
  readonly label: string;
  readonly tooltip?: string;
  readonly trigger?: ReactNode;
  readonly triggerClassName?: string;
  readonly align?: 'left' | 'right';
  readonly anchorKey?: string | null;
  readonly omit?: ReadonlyArray<string>;
};

export const ObjectOverflowMenu = ({
  target,
  label,
  tooltip,
  trigger,
  triggerClassName,
  align = 'right',
  anchorKey = null,
  omit = NO_OMISSIONS,
}: Props) => {
  const dropdown = useDropdown({
    align: align === 'right' ? 'end' : 'start',
    width: 'min-w-[200px] max-w-sm',
    expectedHeight: 320,
    expectedWidth: 240,
  });

  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="shrink-0"
      trigger={
        <Tooltip content={tooltip ?? label} anchorClassName="shrink-0">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              dropdown.toggle();
            }}
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={dropdown.open}
            className={cn(
              'shrink-0 rounded-sm p-1 text-faint-foreground hover:bg-hover hover:text-foreground motion-safe:transition-colors',
              dropdown.open && 'bg-selected text-foreground',
              triggerClassName,
            )}
          >
            {trigger ?? <MoreVertical size={ICON_SIZE.control} aria-hidden />}
          </button>
        </Tooltip>
      }
    >
      <ObjectOverflowList
        target={target}
        label={label}
        anchorKey={anchorKey}
        omit={omit}
        onClose={dropdown.close}
      />
    </AnchoredPopover>
  );
};
