import { useShortcut } from '../../../../../shared/keyboard/useShortcut';
import type { OpenPaletteParams } from '../../../../../features/palette/paletteModeTypes';
import { isDirectedScene } from '../../../../../shared/utils/isDirectedScene';

type Params = {
  readonly openPalette: (params?: OpenPaletteParams) => void;
};

export const useSceneShortcuts = ({ openPalette }: Params): void => {
  const isDirected = isDirectedScene();
  useShortcut('palette.open', () => openPalette(), isDirected);
  useShortcut('search.open', () => openPalette({ mode: 'search' }), isDirected);
};
