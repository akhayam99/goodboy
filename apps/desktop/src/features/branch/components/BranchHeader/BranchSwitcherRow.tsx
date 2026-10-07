import { Check } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { CrumbMenuRow } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { BranchName } from './BranchName';

type Props = {
  readonly row: CrumbMenuRow;
  readonly onChoose: (row: CrumbMenuRow) => void;
};

export const BranchSwitcherRow = ({ row, onChoose }: Props) => (
  <button
    type="button"
    role="menuitemradio"
    aria-checked={row.isCurrent}
    tabIndex={-1}
    data-menu-label={row.label}
    onClick={() => onChoose(row)}
    className={cn(
      'flex h-7.5 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left outline-none',
      'text-foreground hover:bg-hover focus:bg-hover focus-visible:ring-2 focus-visible:ring-focus-ring',
      'motion-safe:transition-colors',
    )}
  >
    <CONCEPT_ICONS.projectRepo
      size={ICON_SIZE.row}
      aria-hidden
      className="shrink-0 text-faint-foreground"
    />
    <BranchName branch={row.label} className="flex-1" />
    {row.secondary === null ? null : (
      <span className="shrink-0 text-meta tabular-nums text-faint-foreground">{row.secondary}</span>
    )}
    <span className="flex w-3.5 shrink-0 items-center justify-center">
      {row.isCurrent ? (
        <Check size={ICON_SIZE.row} aria-hidden className="text-foreground" />
      ) : null}
    </span>
  </button>
);
