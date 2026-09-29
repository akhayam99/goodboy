import { useEffect, useState } from 'react';
import { PANE_RHYTHM } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { PaletteOverlay } from '../../../../../features/palette/components/PaletteOverlay';
import { TranscriptFeed } from '../flow-audit/TranscriptFeed';
import { CHAT_SESSION_ID, PALETTE_CHAT_MOUNTS, noop } from '../flow-audit/fixtures';
import { seedChatSurfaces } from '../flow-audit/seeds';
import { sceneParam } from '../audit/sceneParams';

const QUERY = sceneParam({ key: 'q' }) ?? '';

export const PaletteQueryScene = () => {
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
      <PaletteOverlay initialQuery={QUERY} onClose={noop} />
    </main>
  );
};
