import type { ShortcutEntry } from './registry';

export const LIST_SHORTCUTS = {
  'list.next': { combo: 'KeyJ', label: 'Next row', plane: 'pane', group: 'lists', scope: 'list' },
  'list.previous': {
    combo: 'KeyK',
    label: 'Previous row',
    plane: 'pane',
    group: 'lists',
    scope: 'list',
  },
  'list.open': {
    combo: 'Enter',
    label: 'Open the row, or launch from it',
    plane: 'pane',
    group: 'lists',
    scope: 'list',
  },
  'list.openInTool': {
    combo: 'KeyO',
    label: 'Open in the tool',
    plane: 'pane',
    group: 'lists',
    scope: 'list',
  },
  'list.reply': { combo: 'KeyR', label: 'Reply', plane: 'pane', group: 'lists', scope: 'list' },
  'list.star': {
    combo: 'KeyS',
    label: 'Star or unstar',
    plane: 'pane',
    group: 'lists',
    scope: 'list',
  },
  'list.dismiss': { combo: 'KeyE', label: 'Dismiss', plane: 'pane', group: 'lists', scope: 'list' },
  'list.search': {
    combo: 'Slash',
    label: 'Search the list',
    plane: 'pane',
    group: 'lists',
    scope: 'list',
  },
} as const satisfies Record<string, ShortcutEntry>;
