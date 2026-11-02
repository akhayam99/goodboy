import { useEffect, useState } from 'react';
import { PANE_RHYTHM, ScrollFade } from '@goodboy/ui';
import { TranscriptFeed } from './TranscriptFeed';
import { seedChatSurfaces } from './seeds';
import { useAutoExpand } from './useAutoExpand';

export const TranscriptScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedChatSurfaces();
    setIsReady(true);
  }, []);

  useAutoExpand({ isReady, selector: '[aria-label="Expand resolve findings"]' });

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen bg-background text-foreground">
      <ScrollFade className="h-full" viewportClassName={PANE_RHYTHM.body}>
        <TranscriptFeed />
      </ScrollFade>
    </main>
  );
};
