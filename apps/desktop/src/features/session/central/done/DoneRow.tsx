import type { ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { ICON_SIZE, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import type { DoneRowModel } from './doneTypes';

type Props = {
  readonly row: DoneRowModel;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly chip?: ReactNode;
  readonly children?: ReactNode;
};

export const DoneRow = ({ row, isOpen, onToggle, chip, children }: Props) => {
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    <li data-done-row={row.id} className="flex min-w-0 flex-col gap-1">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className={cn(
          'grid min-h-9 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2 py-1 text-left',
          ROW_INTERACTIVE,
        )}
      >
        <span className="flex size-5 items-center justify-center">
          <Check size={ICON_SIZE.control} aria-hidden className="text-success" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-row text-foreground">{row.title}</span>
            {chip}
          </span>
          <span className="truncate text-meta text-muted-foreground">{row.by}</span>
        </span>
        <span className="flex items-center gap-1 text-meta text-faint-foreground">
          <span>{formatClock({ at: row.at })}</span>
          <Chevron size={ICON_SIZE.control} aria-hidden />
        </span>
      </button>
      {isOpen ? children : null}
    </li>
  );
};
