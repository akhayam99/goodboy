import { useEffect, useState } from 'react';
import { PANE_RHYTHM } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { PaletteOverlay } from '../../../../../features/palette/components/PaletteOverlay';
import type { PaletteModeId } from '../../../../../features/palette/paletteModeTypes';
import { seedBoardScene } from '../BoardScene';
import { mockRunSearch } from '../search/searchFixtures';

type Variant = 'empty' | 'pair' | 'guide' | 'search';

type Props = {
  readonly variant: Variant;
};

type Setup = {
  readonly mode: PaletteModeId;
  readonly query: string;
};

const SETUP_OF: Readonly<Record<Variant, Setup>> = {
  empty: { mode: 'commands', query: '' },
  pair: { mode: 'commands', query: 'pair your iphone' },
  guide: { mode: 'commands', query: 'guide: ' },
  search: { mode: 'search', query: 'credit' },
};

const NOOP = () => undefined;

const PaletteGroupsScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedBoardScene();
    useAppStore.setState({
      runSearch: mockRunSearch,
      loadSearchIndexStatus: async () => undefined,
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  const { mode, query } = SETUP_OF[variant];
  return (
    <ToastProvider>
      <main className="h-screen overflow-hidden bg-background text-foreground">
        <div className={PANE_RHYTHM.body} />
        <PaletteOverlay mode={mode} initialQuery={query} onClose={NOOP} />
      </main>
    </ToastProvider>
  );
};

export const U26S_PALETTE_SCENES = {
  'u26s-palette-empty': () => <PaletteGroupsScene variant="empty" />,
  'u26s-palette-guide': () => <PaletteGroupsScene variant="guide" />,
  'u26s-palette-pair': () => <PaletteGroupsScene variant="pair" />,
  'u26s-palette-search': () => <PaletteGroupsScene variant="search" />,
};
