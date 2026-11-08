import type { ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';
import type { MonitorProcess, PortRow } from '@goodboy/core/monitoring';
import type { PortLayer } from '../../../actions/kinds/port';
import { groupPortRows } from '../../groupPortRows';
import { useMonitoringFold } from '../../hooks/useMonitoringFold';
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
  const fold = useMonitoringFold({ foldKey: `free:${layer}` });
  const grouped = groupPortRows({ rows });
  const isFreeOpen = fold.isOpen && grouped.free.length > 0;

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
            onToggleFree={fold.toggle}
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
