import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { PANE_RHYTHM } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { PaletteOverlay } from '../../../../../features/palette/components/PaletteOverlay';
import { seedBoardScene } from '../BoardScene';
import { sceneParam } from '../audit/sceneParams';
import { noop } from '../flow-audit/fixtures';

const PAYOUT_SESSION = 'mock-board-session-payout-export' as SessionId;

const ON_BOARD = sceneParam({ key: 'at' }) === 'board';

export const PaletteStateScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedBoardScene();
    if (!ON_BOARD) {
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId: PAYOUT_SESSION }) });
    }
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <div className={PANE_RHYTHM.body} />
      <PaletteOverlay onClose={noop} />
    </main>
  );
};
