import { useEffect, type ComponentType } from 'react';
import { seedTopbarBell, seedTopbarLimits } from './topbarSeed';

type Props = {
  readonly Inner: ComponentType;
  readonly providerCount: number;
  readonly width?: number;
};

export const TopbarStatesScene = ({ Inner, providerCount, width }: Props) => {
  useEffect(() => {
    seedTopbarLimits({ count: providerCount });
    seedTopbarBell();
  }, [providerCount]);

  if (width === undefined) {
    return <Inner />;
  }
  return (
    <div className="relative h-screen overflow-hidden" style={{ width }}>
      <Inner />
    </div>
  );
};
