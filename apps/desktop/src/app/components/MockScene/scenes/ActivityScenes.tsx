import { useEffect, useState } from 'react';
import { ScrollFade } from '@goodboy/ui';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { SESSION, seedArtifactScene } from './artifactSeed';

export const ActivityTimelineScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedArtifactScene({ focusedArtifactId: null });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-6 py-4">
        <SessionOverviewPane session={SESSION} />
      </ScrollFade>
    </main>
  );
};
