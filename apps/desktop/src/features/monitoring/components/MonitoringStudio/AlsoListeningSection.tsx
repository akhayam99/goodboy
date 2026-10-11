import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ICON_SIZE, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { MonitorProcess, PortRow } from '@goodboy/core';
import { PortRowView } from './PortRowView';

type Props = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly processOf: (pid: number | null) => MonitorProcess | null;
  readonly now: number;
  readonly isForcedOpen: boolean;
  readonly onWatch: (row: PortRow) => void;
};

export const AlsoListeningSection = ({ rows, processOf, now, isForcedOpen, onWatch }: Props) => {
  const [isToggledOpen, setIsToggledOpen] = useState(false);
  const isOpen = isToggledOpen || isForcedOpen;

  return (
    <section aria-label="Also listening on this Mac" className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsToggledOpen((current) => !current)}
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1 text-left text-label text-muted-foreground',
          ROW_INTERACTIVE,
        )}
      >
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn('shrink-0 motion-safe:transition-transform', isOpen && 'rotate-90')}
        />
        <span className="min-w-0 flex-1 truncate text-foreground">Also listening on this Mac</span>
        <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
          {isOpen ? rows.length : `${rows.length} more`}
        </span>
      </button>
      {isOpen ? (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <PortRowView
              key={row.key}
              row={row}
              process={processOf(row.pid)}
              now={now}
              onWatch={() => onWatch(row)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
};
