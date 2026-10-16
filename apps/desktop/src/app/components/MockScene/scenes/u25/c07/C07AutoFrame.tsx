import { useEffect, useState } from 'react';
import { AppFrame } from '../../audit/AppFrame';
import { seedC07, type C07Seed } from './c07AutoSeed';

type Props = {
  readonly seed: C07Seed;
  readonly isFolded?: boolean;
};

export const C07AutoFrame = ({ seed, isFolded = false }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedC07(seed);
    setIsReady(true);
  }, [seed]);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" isRailCollapsed={isFolded} hasPane />;
};
