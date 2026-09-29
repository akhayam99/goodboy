import { useEffect, useState } from 'react';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { ACTIVITY_RESOLVES_SESSION, seedActivityResolvesScene } from './activityResolvesSeed';
import { ShellFrame } from './shellChrome';

export const ActivityResolvesScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityResolvesScene();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={ACTIVITY_RESOLVES_SESSION}
      sidebar="collapsed"
      main={
        <SessionOverviewPane session={ACTIVITY_RESOLVES_SESSION} onSelectLens={() => undefined} />
      }
    />
  );
};
