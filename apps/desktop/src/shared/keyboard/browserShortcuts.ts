import type { ShortcutEntry } from './registry';

export const BROWSER_SHORTCUTS = {
  'browser.address': {
    combo: 'cmd+KeyL',
    offMacCombo: 'ctrl+shift+KeyL',
    label: 'Browser address',
    plane: 'app',
    group: 'session',
    scope: 'browser',
  },
  'browser.newTab': {
    combo: 'cmd+KeyT',
    offMacCombo: 'ctrl+shift+KeyT',
    label: 'New browser tab',
    plane: 'app',
    group: 'session',
    scope: 'browser',
  },
  'browser.closeTab': {
    combo: 'cmd+KeyW',
    offMacCombo: 'ctrl+shift+KeyW',
    label: 'Close browser tab',
    plane: 'app',
    group: 'window',
    scope: 'browser',
  },
  'browser.reopenTab': {
    combo: 'cmd+shift+KeyT',
    offMacCombo: 'ctrl+alt+shift+KeyT',
    label: 'Reopen closed browser tab',
    plane: 'session',
    group: 'session',
    scope: 'browser',
  },
  'browser.prevTab': {
    combo: 'cmd+shift+BracketLeft',
    label: 'Previous browser tab',
    plane: 'session',
    group: 'session',
    scope: 'browser',
  },
  'browser.nextTab': {
    combo: 'cmd+shift+BracketRight',
    label: 'Next browser tab',
    plane: 'session',
    group: 'session',
    scope: 'browser',
  },
  'browser.pin': {
    combo: 'cmd+KeyD',
    offMacCombo: 'ctrl+shift+KeyD',
    label: 'Pin or unpin browser tab',
    plane: 'app',
    group: 'session',
    scope: 'browser',
  },
} as const satisfies Record<string, ShortcutEntry>;
