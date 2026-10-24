import { useAppStore } from '../../../../../store';
import { useShortcut } from '../../../../../shared/keyboard/useShortcut';
import type { OpenPaletteParams } from '../../../../../features/palette/paletteModeTypes';
import { isDirectedScene } from '../../demo/director/isDirectedScene';

type Params = {
  readonly openPalette: (params?: OpenPaletteParams) => void;
  readonly onToggleSidebar?: () => void;
};

export const useSceneShortcuts = ({ openPalette, onToggleSidebar }: Params): void => {
  const isDirected = isDirectedScene();
  useShortcut('palette.open', () => openPalette(), isDirected);
  useShortcut('search.open', () => openPalette({ mode: 'search' }), isDirected);
  useShortcut(
    'column.toggle',
    () => {
      if (useAppStore.getState().appStudio?.kind === 'settings') {
        return;
      }
      onToggleSidebar?.();
    },
    isDirected && onToggleSidebar !== undefined,
  );
};
