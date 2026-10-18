import { useEffect, useState, type ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';
import type { MonitorProcess, PortRow } from '@goodboy/core';
import type { PortLayer } from '../../../actions/kinds/port';
import { groupPortRows } from '../../groupPortRows';
import { PortGroupList } from './PortGroupList';
import { PortGroupMeta } from './PortGroupMeta';

type RenderParams = {
  readonly row: PortRow;
  readonly isNested: boolean;
};

type Props = {
  readonly label: string;
  readonly layer: PortLayer;
  readonly rows: ReadonlyArray<PortRow>;
  readonly processOf: (pid: number | null) => MonitorProcess | null;
  readonly now: number;
  readonly renderRow: (params: RenderParams) => ReactNode;
  readonly extraCount?: number;
  readonly extraRows?: ReactNode;
  readonly before?: ReactNode;
  readonly after?: ReactNode;
};

export const PortListSection = ({
  label,
  layer,
  rows,
  processOf,
  now,
  renderRow,
  extraCount = 0,
  extraRows,
  before,
  after,
}: Props) => {
  const [isFreeOpen, setIsFreeOpen] = useState(false);
  const grouped = groupPortRows({ rows });
  const freeCount = grouped.free.length;

  useEffect(() => {
    if (freeCount === 0) {
      setIsFreeOpen(false);
    }
  }, [freeCount]);

  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <SectionHeader
        label={label}
        headingLevel={2}
        meta={
          <PortGroupMeta
            count={grouped.inUse.length + extraCount}
            freePorts={grouped.free.map((row) => row.port)}
            isFreeOpen={isFreeOpen}
            onToggleFree={() => setIsFreeOpen((wasOpen) => !wasOpen)}
          />
        }
      />
      {before}
      <PortGroupList
        layer={layer}
        grouped={grouped}
        isFreeOpen={isFreeOpen}
        processOf={processOf}
        now={now}
        renderRow={renderRow}
        extraRows={extraRows}
      />
      {after}
    </section>
  );
};
