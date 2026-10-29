import { useEffect, useState } from 'react';
import { AppFrame } from '../audit/AppFrame';
import { seedC2NextStep } from './c2NextStepSeed';

export const C2NextStepScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedC2NextStep();
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" isRailCollapsed={false} hasPane />;
};
