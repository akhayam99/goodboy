import { useEffect, useState } from 'react';
import { AppFrame } from '../audit/AppFrame';
import { seedE2WorkingNow } from './e2WorkingNowSeed';

type Props = {
  readonly hasTwoChildren: boolean;
};

export const E2WorkingNowScene = ({ hasTwoChildren }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedE2WorkingNow({ hasTwoChildren });
    setIsReady(true);
  }, [hasTwoChildren]);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" isRailCollapsed={false} hasPane />;
};
