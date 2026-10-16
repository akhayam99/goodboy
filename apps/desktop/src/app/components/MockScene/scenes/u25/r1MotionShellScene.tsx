import { useEffect, useState } from 'react';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame } from '../audit/frameSeed';
import { useSceneRailFold } from '../useSceneRailFold';

type Props = {
  readonly isFolded: boolean;
};

export const MotionShellScene = ({ isFolded }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useSceneRailFold({ isFolded });
  useEffect(() => {
    seedFrame({ context: 'session' });
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" isRailCollapsed={isFolded} hasPane hasLiveToggle />;
};
