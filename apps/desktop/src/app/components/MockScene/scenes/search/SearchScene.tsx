import { useEffect, useState } from 'react';
import { PANE_RHYTHM } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { ToastProvider } from '../../../Toast';
import { PaletteOverlay } from '../../../../../features/palette/components/PaletteOverlay';
import { FindInViewController } from '../../../../../features/search/findInView/FindInViewController';
import { TranscriptFeed } from '../flow-audit/TranscriptFeed';
import { seedChatSurfaces } from '../flow-audit/seeds';
import { sceneParam } from '../audit/sceneParams';
import { mockRunSearch } from './searchFixtures';

const noop = () => undefined;

const VIEW = sceneParam({ key: 'view' }) ?? 'overlay';

const OPEN_TEXT: Readonly<Record<string, string>> = {
  overlay: 'credit',
  filters: 'credit type:message from:claude ',
};

const JUMP_TARGET = 'The second credit is not in ledger-core.';

export const SearchScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedChatSurfaces();
    useAppStore.setState({
      runSearch: mockRunSearch,
      loadSearchIndexStatus: async () => undefined,
      searchIndexStatus: {
        docs: 18_406,
        bytes: 15_204_352,
        scanned: 62,
        total: 100,
        isBackfillDone: false,
        excludedProjectIds: [],
      },
      navigate: () => undefined,
    });
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || VIEW !== 'jump') {
      return;
    }
    const id = window.setTimeout(() => {
      useAppStore.getState().startViewFind({ query: 'credit', target: JUMP_TARGET });
    }, 30);
    return () => window.clearTimeout(id);
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <ToastProvider>
      <main className="h-screen overflow-hidden bg-background text-foreground">
        <div data-find-root className={PANE_RHYTHM.body}>
          <TranscriptFeed />
        </div>
        <FindInViewController />
        {VIEW === 'jump' ? null : (
          <PaletteOverlay mode="search" initialQuery={OPEN_TEXT[VIEW] ?? ''} onClose={noop} />
        )}
      </main>
    </ToastProvider>
  );
};
