import { NAMES } from '../utils/names';
import type { ShortcutEntry } from './registry';

export const WINDOW_SHORTCUTS = {
  'app.close': {
    combo: 'cmd+KeyW',
    offMacCombo: 'ctrl+shift+KeyW',
    label: NAMES.closeOrGoBack,
    plane: 'app',
    group: 'window',
  },
  'slot.close': {
    combo: 'cmd+shift+KeyW',
    offMacCombo: 'ctrl+F4',
    label: NAMES.closeThePanel,
    plane: 'session',
    group: 'window',
  },
  'panel.focusNext': {
    combo: 'F6',
    label: 'Focus the next panel',
    plane: 'app',
    group: 'window',
  },
  'panel.focusPrevious': {
    combo: 'shift+F6',
    label: 'Focus the previous panel',
    plane: 'session',
    group: 'window',
  },
} as const satisfies Record<string, ShortcutEntry>;
