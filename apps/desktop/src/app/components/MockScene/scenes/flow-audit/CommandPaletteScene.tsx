import { useEffect, useState } from 'react';
import { PANE_RHYTHM } from '@goodboy/ui';
import { PaletteOverlay } from '../../../../../features/palette/components/PaletteOverlay';
import { TranscriptFeed } from './TranscriptFeed';
import { noop } from './fixtures';
import { seedChatSurfaces } from './seeds';

export const CommandPaletteScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedChatSurfaces();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <div className={PANE_RHYTHM.body}>
        <TranscriptFeed />
      </div>
      <PaletteOverlay onClose={noop} />
    </main>
  );
};
