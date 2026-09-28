import { CommandsMode } from './components/CommandsMode';
import type { PaletteMode } from './paletteModeTypes';

export const PALETTE_MODES: ReadonlyArray<PaletteMode> = [
  {
    id: 'commands',
    label: 'Commands',
    shortcut: 'palette.open',
    widthClass: 'max-w-[820px]',
    Body: CommandsMode,
  },
];
