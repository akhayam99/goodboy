import type { MonitorProcess } from '@goodboy/core/monitoring';
import { formatCpu } from '../../formatCpu';
import { formatMemory } from '../../formatMemory';
import { formatUptime } from '../../formatUptime';
import { isPortColumnShown } from './isPortColumnShown';
import { usePortColumns } from './usePortColumns';

type Props = {
  readonly process: MonitorProcess | null;
  readonly now: number;
};

const CELL = 'text-right tabular-nums text-muted-foreground';

export const MetricCells = ({ process, now }: Props) => {
  const columns = usePortColumns({});
  return (
    <>
      {isPortColumnShown({ columns, column: 'up' }) ? (
        <span className={CELL}>
          {process === null ? '' : formatUptime({ startedAt: process.startedAt, now })}
        </span>
      ) : null}
      {isPortColumnShown({ columns, column: 'cpu' }) ? (
        <span className={CELL}>
          {process === null ? '' : formatCpu({ percent: process.cpuPercent })}
        </span>
      ) : null}
      {isPortColumnShown({ columns, column: 'memory' }) ? (
        <span className={CELL}>
          {process === null ? '' : formatMemory({ bytes: process.rssBytes })}
        </span>
      ) : null}
    </>
  );
};
