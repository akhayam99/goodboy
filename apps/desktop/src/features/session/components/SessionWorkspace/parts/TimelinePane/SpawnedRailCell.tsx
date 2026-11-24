import type { ReactNode } from 'react';
import { TERMINAL_DIM, cn } from '@goodboy/ui';
import { runIdentityStroke } from '../../../../timeline/runIdentity';
import { railColumnX, type RailInk, type RailRow } from '../../../../../workTreeModel/railGeometry';
import { TimelineRail } from './TimelineRail';

type Props = {
  readonly rail: RailRow;
  readonly width: number;
  readonly marker: ReactNode;
  readonly tail?: ReadonlyArray<RailInk>;
};

const NO_TAIL: ReadonlyArray<RailInk> = [];

export const SpawnedRailCell = ({ rail, width, marker, tail = NO_TAIL }: Props) => (
  <span data-spawned-rail="" className="relative shrink-0 self-stretch" style={{ width }}>
    <TimelineRail rail={rail} width={width} />
    {tail.map((ink) => (
      <span
        key={ink.column}
        aria-hidden
        data-rail-tail={ink.column}
        className={cn(
          'pointer-events-none absolute bottom-0 border-l border-border-soft',
          ink.dash === 'dashed' && 'border-dashed',
          ink.isMuted && TERMINAL_DIM,
        )}
        style={{
          left: railColumnX({ column: ink.column }) - 0.5,
          top: rail.height,
          borderColor:
            ink.identityIndex == null ? undefined : runIdentityStroke({ index: ink.identityIndex }),
        }}
      />
    ))}
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
