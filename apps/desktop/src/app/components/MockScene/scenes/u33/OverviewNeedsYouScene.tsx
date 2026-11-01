import { useEffect, useState } from 'react';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { CentralColumnPane } from '../u26/CentralColumnPane';
import { seedOverviewNeedsYou } from './overviewNeedsYouSeed';

const FRAME_WIDTH = 680;
const HIDDEN_CARDS =
  '[&_[data-overview-card=branches]]:hidden [&_[data-overview-card=done]]:hidden';

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
        style={{ width: FRAME_WIDTH }}
        className={`bg-background text-foreground [&>div]:h-auto [&>div]:w-full ${HIDDEN_CARDS}`}
      >
        <CentralColumnPane />
      </div>
    </AutoReleaseContext.Provider>
  );
};
