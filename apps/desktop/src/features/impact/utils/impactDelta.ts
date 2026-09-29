import { formatHours } from './formatHours';

type DeltaDirection = 'up' | 'down' | 'flat';

export type ImpactDelta = {
  readonly direction: DeltaDirection;
  readonly label: string;
  readonly isBetter: boolean;
};

type DeltaUnit = 'count' | 'points' | 'hours';

type Params = {
  readonly current: number;
  readonly previous: number | null;
  readonly unit: DeltaUnit;
  readonly isLowerBetter?: boolean;
};

type AmountParams = {
  readonly current: number;
  readonly previous: number;
  readonly unit: DeltaUnit;
};

const amount = ({ current, previous, unit }: AmountParams): string => {
  const difference = Math.abs(current - previous);
  if (unit === 'points') {
    const points = Math.round(difference);
    return `${points} ${points === 1 ? 'pt' : 'pts'}`;
  }
  if (unit === 'hours') {
    return formatHours({ hours: difference });
  }
  if (previous === 0) {
    return 'from 0';
  }
  return `${Math.round((difference / previous) * 100)}%`;
};

export const impactDelta = ({
  current,
  previous,
  unit,
  isLowerBetter = false,
}: Params): ImpactDelta | null => {
  if (previous === null) {
    return null;
  }
  if (current === previous) {
    return { direction: 'flat', label: 'no change', isBetter: false };
  }
  const direction: DeltaDirection = current > previous ? 'up' : 'down';
  const isBetter = isLowerBetter ? direction === 'down' : direction === 'up';
  return {
    direction,
    label: `${direction} ${amount({ current, previous, unit })}`,
    isBetter,
  };
};
