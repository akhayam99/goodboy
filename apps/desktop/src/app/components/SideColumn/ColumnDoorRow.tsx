import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';

type Props = {
  readonly id: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly shortcut?: string;
  readonly isCurrent: boolean;
  readonly trailing?: ReactNode;
  readonly onSelect: () => void;
};

export const ColumnDoorRow = ({
  id,
  icon: Icon,
  label,
  shortcut,
  isCurrent,
  trailing,
  onSelect,
}: Props) => (
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
      PANE_RHYTHM.navRail.door,
      'group flex w-full min-w-0 shrink-0 items-center gap-2 rounded-md text-row motion-safe:transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
      isCurrent
        ? 'cursor-default bg-selected text-foreground'
        : 'text-muted-foreground hover:bg-hover hover:text-foreground',
    )}
  >
    <Icon size={ICON_SIZE.control} aria-hidden className="shrink-0" />
    <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    {trailing}
    {shortcut === undefined ? null : (
      <span
        aria-hidden
        className="shrink-0 text-chip text-faint-foreground opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {shortcut}
      </span>
    )}
  </button>
);
