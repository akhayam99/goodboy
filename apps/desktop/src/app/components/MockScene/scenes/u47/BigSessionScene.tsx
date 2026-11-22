import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { ScenePlacesRail } from '../ScenePlacesRail';
import { BigSessionPane } from './BigSessionPane';
import { seedBigSession } from './bigSessionSeed';

type Props = {
  readonly isLogOpen?: boolean;
};

const WIDTH = 1180;
const HEIGHT = 900;

export const BigSessionScene = ({ isLogOpen = false }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedBigSession();
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <div
        data-shot
        style={{ width: WIDTH, height: HEIGHT }}
        className="[&>div]:h-full [&>div]:w-full"
      >
        <AppShell leftRail={<ScenePlacesRail />} main={<BigSessionPane isLogOpen={isLogOpen} />} />
      </div>
    </AutoReleaseContext.Provider>
  );
};
