import { useEffect, useState } from 'react';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { ACTIVITY_RESOLVES_SESSION, seedActivityResolvesScene } from './activityResolvesSeed';
import { useSceneClicks } from './audit/useSceneClicks';
import { ShellFrame } from './shellChrome';

const OPEN_GROUPS: ReadonlyArray<string> = ['Harden the webhook', 'subagents'];

export const ActivityGroupsScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityResolvesScene();
    setIsReady(true);
  }, []);

  useSceneClicks({
    isReady,
    labels: OPEN_GROUPS,
    selector: '[data-row-id] button',
    match: 'contains',
    intervalMs: 300,
  });

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={ACTIVITY_RESOLVES_SESSION}
      sidebar="expanded"
      main={
        <SessionOverviewPane session={ACTIVITY_RESOLVES_SESSION} onSelectLens={() => undefined} />
      }
    />
  );
};
