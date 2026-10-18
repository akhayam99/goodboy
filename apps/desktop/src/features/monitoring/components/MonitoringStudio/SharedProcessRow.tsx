import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { ICON_SIZE, ROW_HOVER, cn } from '@goodboy/ui';
import type { MonitorProcess, PortRow } from '@goodboy/core';
import { portListText } from '../../portListText';
import type { PortLayer } from '../../../actions/kinds/port';
import { MetricCells } from './MetricCells';
import { OwnerCell } from './OwnerCell';
import { PORT_GRID } from './portGrid';
import { ProcessCell } from './ProcessCell';
import { SharedProcessActions } from './SharedProcessActions';

type RenderParams = {
  readonly row: PortRow;
  readonly isNested: boolean;
};

type Props = {
  readonly layer: PortLayer;
  readonly pid: number;
  readonly rows: ReadonlyArray<PortRow>;
  readonly process: MonitorProcess | null;
  readonly now: number;
  readonly renderRow: (params: RenderParams) => ReactNode;
};

const PORTS_SHOWN = 3;

export const SharedProcessRow = ({ layer, pid, rows, process, now, renderRow }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const first = rows[0];
  if (first === undefined) {
    return null;
  }
  const processName = first.processName ?? `Process ${pid}`;
  const portCount = new Set(rows.map((row) => row.port)).size;

  return (
    <li data-shared-pid={pid} className="flex flex-col">
      <div className={cn('group/row relative rounded-md', ROW_HOVER)}>
        <div className={cn(PORT_GRID, 'min-h-8 text-label')}>
          <ChevronRight
            size={ICON_SIZE.row}
            aria-hidden
            className={cn(
              'text-faint-foreground motion-safe:transition-transform',
              isOpen && 'rotate-90',
            )}
          />
          <span className="col-span-2 min-w-0 truncate tabular-nums text-foreground">
            {portListText({ ports: rows.map((row) => row.port), max: PORTS_SHOWN })}
          </span>
          <OwnerCell row={first} />
          <ProcessCell
            name={processName}
            pid={pid}
            toggleLabel={`${isOpen ? 'Hide' : 'Show'} ${portCount} ports of ${processName}`}
            isOpen={isOpen}
            onToggle={() => setIsOpen((wasOpen) => !wasOpen)}
          />
          <MetricCells process={process} now={now} />
          <SharedProcessActions row={first} layer={layer} />
        </div>
      </div>
      {isOpen ? (
        <ul className="flex flex-col">{rows.map((row) => renderRow({ row, isNested: true }))}</ul>
      ) : null}
    </li>
  );
};
