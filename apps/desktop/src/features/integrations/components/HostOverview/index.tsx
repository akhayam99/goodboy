import type { ReactNode } from 'react';
import { HostRail } from './HostRail';
import type { HostRailFacts } from './types';

type Props = {
  readonly rail: HostRailFacts;
  readonly children: ReactNode;
};

export const HostOverview = ({ rail, children }: Props) => (
  <div
    data-slot="overview-grid"
    className="@container grid min-w-0 grid-cols-1 gap-8 @[880px]:grid-cols-[minmax(0,1fr)_17.5rem]"
  >
    <div className="order-1 min-w-0 @[880px]:order-2">
      <HostRail rail={rail} />
    </div>
    <div
      data-slot="reading-column"
      className="order-2 flex min-w-0 max-w-170 flex-col gap-6 @[880px]:order-1"
    >
      {children}
    </div>
  </div>
);
