import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';

type Props = {
  readonly id: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly shortcut?: string;
  readonly isCurrent: boolean;
  readonly className?: string;
  readonly badge?: ReactNode;
  readonly onSelect: () => void;
};

const RAIL_BUTTON =
  'relative flex size-8 shrink-0 items-center justify-center rounded-md motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const RailButton = ({
  id,
  icon: Icon,
  label,
  shortcut,
  isCurrent,
  className,
  badge,
  onSelect,
}: Props) => (
  <Tooltip content={shortcut === undefined ? label : `${label}  ${shortcut}`} side="right">
    <button
      type="button"
      data-column-door={id}
      aria-label={label}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={() => {
        if (isCurrent) {
          return;
        }
        onSelect();
      }}
      className={cn(
        RAIL_BUTTON,
        isCurrent
          ? 'cursor-default bg-selected text-foreground'
          : 'text-muted-foreground hover:bg-hover hover:text-foreground',
        className,
      )}
    >
      <Icon size={ICON_SIZE.control} aria-hidden />
      {badge}
    </button>
  </Tooltip>
);
