import type { ReactNode } from 'react';
import { railColumnX } from '../../../workTreeModel/railGeometry';

type Props = {
  readonly slotWidth: number;
  readonly children: ReactNode;
};

export const OrchestratedPlanSlot = ({ slotWidth, children }: Props) => (
  <span aria-hidden className="relative h-full shrink-0" style={{ width: slotWidth }}>
    <span
      className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
      style={{ left: railColumnX({ column: 0 }) }}
    >
      {children}
    </span>
  </span>
);
