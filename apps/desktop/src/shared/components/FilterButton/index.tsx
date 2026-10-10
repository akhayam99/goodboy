import type { ReactNode } from 'react';
import { Funnel, PanelLeftOpen } from 'lucide-react';
import { AnchoredPopover, Button, Chip, IconButton, Tooltip, cn, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly popoverLabel: string;
  readonly activeCount: number;
  readonly facets: ReactNode;
  readonly onDock?: (() => void) | undefined;
};

export const FilterButton = ({ popoverLabel, activeCount, facets, onDock }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedHeight: 420 });
  const hasActive = activeCount > 0;
  const label = hasActive ? `Filters, ${activeCount} active` : 'Filters';

  return (
    <>
      {onDock === undefined ? null : (
        <IconButton icon={PanelLeftOpen} label="Dock the filters" onClick={onDock} />
      )}
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel={popoverLabel}
        className="max-h-[70vh] py-1"
        trigger={
          <Tooltip content="Filters">
            <Button
              variant="secondary"
              size="sm"
              aria-label={label}
              aria-expanded={dropdown.open}
              aria-haspopup="dialog"
              onClick={dropdown.toggle}
              className={cn(dropdown.open && 'bg-selected')}
            >
              <Funnel size={ICON_SIZE.row} aria-hidden />
              {hasActive ? <Chip kind="count" tone="neutral" label={activeCount} /> : null}
            </Button>
          </Tooltip>
        }
      >
        {facets}
      </AnchoredPopover>
    </>
  );
};
