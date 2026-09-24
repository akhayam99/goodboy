import { useEffect, useState } from 'react';
import { PANE_RHYTHM } from '@goodboy/ui';
import { CommandPalette } from '../../../../../features/session/components/CommandPalette';
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
      <CommandPalette onClose={noop} />
    </main>
  );
};
