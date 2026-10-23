import { useEffect, useState } from 'react';
import { LogPane } from '../../../../features/session/central/log/LogPane';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { ACTIVITY_RESOLVES_SESSION, seedActivityResolvesScene } from './activityResolvesSeed';
import { ShellFrame } from './shellChrome';

export type ActivityResolvesStep = 'none' | 'log';

export const ActivityResolvesStage = ({ step }: { readonly step: ActivityResolvesStep }) => {
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
        step === 'log' ? (
          <LogPane session={ACTIVITY_RESOLVES_SESSION} />
        ) : (
          <SessionOverviewPane session={ACTIVITY_RESOLVES_SESSION} />
        )
      }
    />
  );
};
