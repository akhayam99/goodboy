import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { PANE_RHYTHM } from '@goodboy/ui';
import { useAppStore } from '../../../../../../store';
import { sessionPlace } from '../../../../../../store/slices/navigation/place';
import { PaletteOverlay } from '../../../../../../features/palette/components/PaletteOverlay';
import { seedBoardScene } from '../../BoardScene';

const PAYOUT_SESSION = 'mock-board-session-payout-export' as SessionId;

const noop = () => undefined;

type Props = {
  readonly initialQuery: string;
};

export const PaletteStableHeightScene = ({ initialQuery }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedBoardScene();
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId: PAYOUT_SESSION }) });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <div className={PANE_RHYTHM.body} />
      <PaletteOverlay initialQuery={initialQuery} onClose={noop} />
    </main>
  );
};
