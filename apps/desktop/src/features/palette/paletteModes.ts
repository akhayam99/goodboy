import { CommandsMode } from './components/CommandsMode';
import { SearchMode } from '../search/components/SearchMode';
import type { PaletteMode } from './paletteModeTypes';
import { NAMES } from '../../shared/utils/names';

export const PALETTE_MODES: ReadonlyArray<PaletteMode> = [
  {
    id: 'commands',
    label: NAMES.commands,
    shortcut: 'palette.open',
    widthClass: 'max-w-[640px]',
    Body: CommandsMode,
  },
  {
    id: 'search',
    label: 'Search',
    shortcut: 'search.open',
    widthClass: 'max-w-[720px]',
    Body: SearchMode,
  },
];
