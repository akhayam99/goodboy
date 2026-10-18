import { useEffect, useState } from 'react';
import { seedImpactScene } from '../../ImpactScene';
import { StudioFrame } from '../../StudioFrame';
import { ImpactSceneBody } from './ImpactSceneBody';
import type { ImpactSceneMode } from './impactSceneMode';

type Props = {
  readonly mode: ImpactSceneMode;
};

export const ImpactSceneFrame = ({ mode }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedImpactScene();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <StudioFrame target={{ place: 'impact', tool: null }} main={<ImpactSceneBody mode={mode} />} />
  );
};
