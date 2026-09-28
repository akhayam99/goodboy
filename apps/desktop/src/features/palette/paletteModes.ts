import { CommandsMode } from './components/CommandsMode';
import { SearchMode } from '../search/components/SearchMode';
import type { PaletteMode } from './paletteModeTypes';

export const PALETTE_MODES: ReadonlyArray<PaletteMode> = [
  {
    id: 'commands',
    label: 'Commands',
    shortcut: 'palette.open',
    widthClass: 'max-w-[820px]',
    Body: CommandsMode,
  },
  {
    id: 'search',
    label: 'Search',
    shortcut: 'search.open',
    widthClass: 'max-w-[920px]',
    Body: SearchMode,
  },
];
