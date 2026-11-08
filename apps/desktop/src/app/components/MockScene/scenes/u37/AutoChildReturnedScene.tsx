import { useEffect, useState } from 'react';
import { AppFrame } from '../audit/AppFrame';
import { useSceneRailFold } from '../useSceneRailFold';
import { seedAutoChildReturned, type AutoChildReturnedState } from './autoChildReturnedSeed';

type Props = {
  readonly state: AutoChildReturnedState;
};

export const AutoChildReturnedScene = ({ state }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useSceneRailFold({ isFolded: false });
  useEffect(() => {
    seedAutoChildReturned({ state });
    setIsReady(true);
  }, [state]);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" isRailCollapsed={false} hasPane />;
};
