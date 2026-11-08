import { ChevronRight } from 'lucide-react';
import { ICON_SIZE, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { MonitorProcess, PortRow } from '@goodboy/core/monitoring';
import { groupPortRows } from '../../groupPortRows';
import { useMonitoringFold } from '../../hooks/useMonitoringFold';
import { shownRowCount } from '../../shownRowCount';
import { PortGroupList } from './PortGroupList';
import { PortRowItem } from './PortRowItem';

type Props = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly processOf: (pid: number | null) => MonitorProcess | null;
  readonly now: number;
  readonly isForcedOpen: boolean;
};

export const ListeningSection = ({ rows, processOf, now, isForcedOpen }: Props) => {
  const fold = useMonitoringFold({ foldKey: 'listening' });
  const isOpen = fold.isOpen || isForcedOpen;

  return (
    <section aria-label="Listening on this Mac" className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={fold.toggle}
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1 text-left text-meta text-muted-foreground',
          ROW_INTERACTIVE,
        )}
      >
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn('shrink-0 motion-safe:transition-transform', isOpen && 'rotate-90')}
        />
        <span className="min-w-0 truncate text-foreground">Listening on this Mac</span>
        {shownRowCount({ rows }) > 1 ? (
          <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
            {shownRowCount({ rows })}
          </span>
        ) : null}
      </button>
      {isOpen ? (
        <PortGroupList
          layer="listening"
          grouped={groupPortRows({ rows })}
          isFreeOpen
          processOf={processOf}
          now={now}
          renderRow={({ row, isNested }) => (
            <PortRowItem
              key={row.key}
              row={row}
              layer="listening"
              process={processOf(row.pid)}
              now={now}
              name=""
              isNested={isNested}
            />
          )}
        />
      ) : null}
    </section>
  );
};
