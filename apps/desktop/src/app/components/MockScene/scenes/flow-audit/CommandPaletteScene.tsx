import { useEffect, useState } from 'react';
import { PANE_RHYTHM } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { PaletteOverlay } from '../../../../../features/palette/components/PaletteOverlay';
import { TranscriptFeed } from './TranscriptFeed';
import { CHAT_SESSION_ID, PALETTE_CHAT_MOUNTS, noop } from './fixtures';
import { seedChatSurfaces } from './seeds';

export const CommandPaletteScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedChatSurfaces();
    useAppStore.setState((state) => ({
      sessionProjectMounts: {
        ...state.sessionProjectMounts,
        [CHAT_SESSION_ID]: PALETTE_CHAT_MOUNTS,
      },
      sessionWorktrees: {
        ...state.sessionWorktrees,
        [CHAT_SESSION_ID]: PALETTE_CHAT_MOUNTS.map((mount) => mount.worktreePath),
      },
    }));
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
