import { useEffect, useState } from 'react';
import { PANE_RHYTHM } from '@goodboy/ui';
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
    <main className="h-screen overflow-auto bg-background text-foreground">
      <div className={PANE_RHYTHM.body}>
        <TranscriptFeed />
      </div>
    </main>
  );
};
