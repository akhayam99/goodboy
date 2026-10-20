import type { ReactNode } from 'react';
import { TimelineRail } from '../../../features/session/components/SessionWorkspace/parts/TimelinePane/TimelineRail';
import { railColumnX, type RailRow } from '../../../features/workTreeModel/railGeometry';

type Props = {
  readonly rail: RailRow;
  readonly width: number;
  readonly marker: ReactNode;
};

export const SpawnedRailCell = ({ rail, width, marker }: Props) => (
  <span data-spawned-rail="" className="relative shrink-0 self-stretch" style={{ width }}>
    <TimelineRail rail={rail} width={width} />
    <span
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{
        left: railColumnX({ column: rail.markerColumn }),
        top: rail.markerY ?? rail.height / 2,
      }}
    >
      {marker}
    </span>
  </span>
);
