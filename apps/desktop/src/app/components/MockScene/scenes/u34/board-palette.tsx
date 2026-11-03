import { BoardScene } from '../BoardScene';
import { CommandPaletteScene } from '../flow-audit/CommandPaletteScene';

export const U34_BOARD_PALETTE_SCENES = {
  'u34-u26-board': () => <BoardScene frame={{ widthPx: 1280, columnPx: 244 }} />,
  'u34-u53-palette': CommandPaletteScene,
};
