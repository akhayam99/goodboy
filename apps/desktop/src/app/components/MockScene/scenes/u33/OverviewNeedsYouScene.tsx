import { useEffect, useState } from 'react';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { CentralColumnPane } from '../u26/CentralColumnPane';
import { seedOverviewNeedsYou } from './overviewNeedsYouSeed';

const FRAME_WIDTH = 680;
const FRAME_HEIGHT = 560;

export const OverviewNeedsYouScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedOverviewNeedsYou();
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <div
        data-shot
        style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}
        className="bg-background text-foreground [&>div]:h-full [&>div]:w-full"
      >
        <CentralColumnPane />
      </div>
    </AutoReleaseContext.Provider>
  );
};
