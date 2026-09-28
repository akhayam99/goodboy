import type { ComponentType, ReactNode } from 'react';
import type { ShortcutId } from '../../shared/keyboard/registry';
import type { PaletteScope } from './types';

export type PaletteModeId = 'commands' | 'search';

export type PaletteModeProps = {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly scope: PaletteScope | null;
  readonly onClearScope: () => void;
  readonly onSwitchMode: () => void;
  readonly onClose: () => void;
  readonly modeSwitch: ReactNode;
};

export type PaletteMode = {
  readonly id: PaletteModeId;
  readonly label: string;
  readonly shortcut: ShortcutId;
  readonly widthClass: string;
  readonly Body: ComponentType<PaletteModeProps>;
};

export type PaletteRequest = {
  readonly mode: PaletteModeId;
  readonly query: string;
};

export type OpenPaletteParams = {
  readonly mode?: PaletteModeId;
  readonly query?: string;
};
