import { useEffect, useState } from 'react';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { SESSION, seedActivityRunScene } from './activityRunSeed';
import { useHoveredMountRow, useShowCompletedMounts } from './sceneReveal';

export const ActivityRunScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    setIsReady(true);
  }, []);

  useShowCompletedMounts({ isReady });
  useHoveredMountRow({ isReady, rowLabel: 'nw/backfill-processed-events' });

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        <SessionOverviewPane session={SESSION} onSelectLens={() => undefined} />
      </div>
    </main>
  );
};
