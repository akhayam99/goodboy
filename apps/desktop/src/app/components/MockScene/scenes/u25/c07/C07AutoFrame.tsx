import { useEffect, useState } from 'react';
import { AppFrame } from '../../audit/AppFrame';
import { useSceneRailFold } from '../../useSceneRailFold';
import { useSceneClicks } from '../../audit/useSceneClicks';
import { seedC07, type C07Seed } from './c07AutoSeed';

type Props = {
  readonly seed: C07Seed;
  readonly isFolded?: boolean;
  readonly clicks?: ReadonlyArray<string>;
  readonly widthPx?: number;
};

const NO_CLICKS: ReadonlyArray<string> = [];

export const C07AutoFrame = ({ seed, isFolded = false, clicks = NO_CLICKS, widthPx }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useSceneRailFold({ isFolded });
  useSceneClicks({ isReady, labels: clicks, selector: 'button', match: 'prefix', intervalMs: 400 });
  useEffect(() => {
    seedC07(seed);
    setIsReady(true);
  }, [seed]);
  if (!isReady) {
    return null;
  }
  const frame = <AppFrame view="session" isRailCollapsed={false} hasPane />;
  if (widthPx === undefined) {
    return frame;
  }
  return (
    <div className="h-full shrink-0 overflow-hidden" style={{ width: widthPx }}>
      {frame}
    </div>
  );
};
