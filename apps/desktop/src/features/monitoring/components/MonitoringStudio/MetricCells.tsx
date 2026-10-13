import type { MonitorProcess } from '@goodboy/core';
import { formatCpu } from '../../formatCpu';
import { formatMemory } from '../../formatMemory';
import { formatUptime } from '../../formatUptime';

type Props = {
  readonly process: MonitorProcess | null;
  readonly now: number;
};

const CELL = 'text-right tabular-nums text-muted-foreground';

export const MetricCells = ({ process, now }: Props) => (
  <>
    <span className={CELL}>
      {process === null ? '' : formatUptime({ startedAt: process.startedAt, now })}
    </span>
    <span className={CELL}>
      {process === null ? '' : formatCpu({ percent: process.cpuPercent })}
    </span>
    <span className={CELL}>
      {process === null ? '' : formatMemory({ bytes: process.rssBytes })}
    </span>
  </>
);
