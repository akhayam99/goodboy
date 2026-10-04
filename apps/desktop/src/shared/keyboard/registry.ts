import { currentPlatform } from '../platform';
import { NAMES } from '../names';

type ShortcutPlane = 'app' | 'session' | 'lens' | 'pane';

export type ShortcutGroup =
  | 'general'
  | 'workspaces'
  | 'navigate'
  | 'session'
  | 'views'
  | 'lists'
  | 'selection'
  | 'review'
  | 'diff'
  | 'window';

export type ShortcutScope =
  | 'list'
  | 'selection'
  | 'review'
  | 'diff'
  | 'terminal'
  | 'composer'
  | 'find'
  | 'overview'
  | 'row'
  | 'activityRow'
  | 'workspace'
  | 'codeSession'
  | 'exploreSession';

export const SHORTCUT_SCOPE_LABEL: Readonly<Record<ShortcutScope, string>> = {
  list: 'In the Inbox and Notifications lists',
  selection: 'In a list with checkboxes',
  review: 'In the Review view',
  diff: 'In the Diff view',
  terminal: 'In the terminal',
  composer: 'Where a chat composer is open',
  find: 'After a search in the view',
  overview: 'On a session overview',
  row: 'On a focused row',
  activityRow: 'On an activity row',
  workspace: 'With a workspace open',
  codeSession: 'In a session with a branch',
  exploreSession: 'In an explore session',
};

export type ShortcutFamily = 'workspace-digit';

export type ShortcutEntry = {
  readonly combo: string;
  readonly offMacCombo?: string;
  readonly label: string;
  readonly plane: ShortcutPlane;
  readonly group: ShortcutGroup;
  readonly family?: ShortcutFamily;
  readonly scope?: ShortcutScope;
  readonly yieldsToText?: boolean;
};

export const SHORTCUTS = {
  'palette.open': { combo: 'cmd+KeyK', label: 'Command palette', plane: 'app', group: 'general' },
  'search.open': { combo: 'cmd+KeyF', label: 'Search', plane: 'app', group: 'general' },
  'settings.open': { combo: 'cmd+Comma', label: 'Settings', plane: 'app', group: 'general' },
  'settings.shortcuts': {
    combo: 'cmd+Slash',
    label: 'Keyboard shortcuts',
    plane: 'app',
    group: 'general',
  },
  'session.new': { combo: 'cmd+KeyN', label: 'New session', plane: 'app', group: 'general' },
  'report.open': {
    combo: 'cmd+KeyI',
    offMacCombo: 'ctrl+shift+KeyI',
    label: 'Report a bug',
    plane: 'app',
    group: 'general',
  },
  'app.reload': { combo: 'cmd+KeyR', label: 'Reload', plane: 'app', group: 'general' },

  'workspace.switcher': {
    combo: 'cmd+KeyO',
    label: 'Switch workspace',
    plane: 'app',
    group: 'workspaces',
    scope: 'workspace',
  },
  'workspace.1': {
    combo: 'cmd+Digit1',
    label: 'Workspace 1',
    plane: 'app',
    group: 'workspaces',
    family: 'workspace-digit',
  },
  'workspace.2': {
    combo: 'cmd+Digit2',
    label: 'Workspace 2',
    plane: 'app',
    group: 'workspaces',
    family: 'workspace-digit',
  },
  'workspace.3': {
    combo: 'cmd+Digit3',
    label: 'Workspace 3',
    plane: 'app',
    group: 'workspaces',
    family: 'workspace-digit',
  },
  'workspace.4': {
    combo: 'cmd+Digit4',
    label: 'Workspace 4',
    plane: 'app',
    group: 'workspaces',
    family: 'workspace-digit',
  },
  'workspace.5': {
    combo: 'cmd+Digit5',
    label: 'Workspace 5',
    plane: 'app',
    group: 'workspaces',
    family: 'workspace-digit',
  },
  'workspace.6': {
    combo: 'cmd+Digit6',
    label: 'Workspace 6',
    plane: 'app',
    group: 'workspaces',
    family: 'workspace-digit',
  },
  'workspace.7': {
    combo: 'cmd+Digit7',
    label: 'Workspace 7',
    plane: 'app',
    group: 'workspaces',
    family: 'workspace-digit',
  },
  'workspace.8': {
    combo: 'cmd+Digit8',
    label: 'Workspace 8',
    plane: 'app',
    group: 'workspaces',
    family: 'workspace-digit',
  },
  'workspace.9': {
    combo: 'cmd+Digit9',
    label: 'Workspace 9',
    plane: 'app',
    group: 'workspaces',
    family: 'workspace-digit',
  },

  'nav.back': { combo: 'cmd+BracketLeft', label: 'Back', plane: 'app', group: 'navigate' },
  'nav.forward': { combo: 'cmd+BracketRight', label: 'Forward', plane: 'app', group: 'navigate' },
  'find.next': {
    combo: 'cmd+KeyG',
    label: 'Next match',
    plane: 'app',
    group: 'navigate',
    scope: 'find',
  },
  'find.previous': {
    combo: 'cmd+shift+KeyG',
    label: 'Previous match',
    plane: 'session',
    group: 'navigate',
    scope: 'find',
  },
  'column.toggle': {
    combo: 'cmd+KeyB',
    label: 'Show or hide the session sidebar',
    plane: 'app',
    group: 'navigate',
  },
  'session.board': {
    combo: 'cmd+shift+KeyH',
    label: 'Board',
    plane: 'session',
    group: 'navigate',
  },
  'session.prev': {
    combo: 'cmd+shift+BracketLeft',
    label: 'Previous session',
    plane: 'session',
    group: 'navigate',
  },
  'session.next': {
    combo: 'cmd+shift+BracketRight',
    label: 'Next session',
    plane: 'session',
    group: 'navigate',
  },

  'session.model': {
    combo: 'cmd+shift+KeyM',
    label: 'Model picker',
    plane: 'session',
    group: 'session',
    scope: 'composer',
  },
  'session.permissions': {
    combo: 'cmd+shift+KeyP',
    label: 'Permission picker',
    plane: 'session',
    group: 'session',
    scope: 'composer',
  },
  'composer.submit': {
    combo: 'cmd+Enter',
    label: 'Submit, or push in Review',
    plane: 'app',
    group: 'session',
  },
  'composer.send': {
    combo: 'Enter',
    label: 'Send a message, new line in a document',
    plane: 'pane',
    group: 'session',
    scope: 'composer',
  },
  'composer.newLine': {
    combo: 'shift+Enter',
    label: 'New line in a message',
    plane: 'session',
    group: 'session',
    scope: 'composer',
  },
  'menu.open': {
    combo: 'shift+F10',
    label: 'Open the menu of the focused row',
    plane: 'session',
    group: 'general',
    scope: 'row',
  },
  'activity.openRun': {
    combo: 'shift+Enter',
    label: 'Open the workflow of an activity row',
    plane: 'session',
    group: 'session',
    scope: 'activityRow',
  },
  'terminal.newTab': {
    combo: 'cmd+KeyT',
    offMacCombo: 'ctrl+shift+KeyT',
    label: 'New terminal tab',
    plane: 'app',
    group: 'session',
    scope: 'terminal',
  },
  'session.archive': {
    combo: 'cmd+shift+KeyA',
    label: 'Archive session',
    plane: 'session',
    group: 'session',
  },
  'session.delete': {
    combo: 'cmd+shift+Backspace',
    label: 'Delete session',
    plane: 'session',
    group: 'session',
  },
  'session.linkWork': {
    combo: 'KeyL',
    label: 'Link work, on the overview',
    plane: 'app',
    group: 'session',
    scope: 'overview',
  },
  'session.refresh': {
    combo: 'cmd+shift+KeyR',
    label: 'Refresh session',
    plane: 'session',
    group: 'session',
  },

  'lens.overview': { combo: 'cmd+alt+KeyO', label: 'Session', plane: 'lens', group: 'views' },
  'lens.context': { combo: 'cmd+alt+KeyC', label: 'Show context', plane: 'lens', group: 'views' },
  'lens.goal': { combo: 'cmd+alt+KeyG', label: 'Context: Goal', plane: 'lens', group: 'views' },
  'lens.decisions': {
    combo: 'cmd+alt+KeyE',
    label: 'Context: Decisions',
    plane: 'lens',
    group: 'views',
  },
  'lens.summary': {
    combo: 'cmd+alt+KeyU',
    label: 'Context: Summary',
    plane: 'lens',
    group: 'views',
  },
  'lens.workflows': { combo: 'cmd+alt+KeyW', label: NAMES.runs, plane: 'lens', group: 'views' },
  'lens.agents': { combo: 'cmd+alt+KeyA', label: 'Agents', plane: 'lens', group: 'views' },
  'lens.review': { combo: 'cmd+alt+KeyR', label: 'Review', plane: 'lens', group: 'views' },
  'lens.questions': { combo: 'cmd+alt+KeyQ', label: 'Questions', plane: 'lens', group: 'views' },
  'lens.files': {
    combo: 'cmd+alt+KeyF',
    label: 'Diff',
    plane: 'lens',
    group: 'views',
    scope: 'codeSession',
  },
  'lens.explore': {
    combo: 'cmd+alt+KeyX',
    label: 'Explore',
    plane: 'lens',
    group: 'views',
    scope: 'exploreSession',
  },
  'lens.plans': { combo: 'cmd+alt+KeyP', label: 'Artifacts', plane: 'lens', group: 'views' },
  'lens.scripts': { combo: 'cmd+alt+KeyS', label: 'Scripts', plane: 'lens', group: 'views' },
  'lens.terminal': { combo: 'cmd+alt+KeyT', label: 'Terminal', plane: 'lens', group: 'views' },
  'lens.pr': { combo: 'cmd+alt+Digit1', label: 'Pull request', plane: 'lens', group: 'views' },
  'lens.linear': { combo: 'cmd+alt+Digit2', label: 'Linear', plane: 'lens', group: 'views' },
  'lens.gitlab_issues': {
    combo: 'cmd+alt+Digit4',
    label: 'GitLab issues',
    plane: 'lens',
    group: 'views',
  },
  'lens.jira_issues': {
    combo: 'cmd+alt+Digit5',
    label: 'Jira issues',
    plane: 'lens',
    group: 'views',
  },
  'lens.slack_threads': {
    combo: 'cmd+alt+Digit6',
    label: 'Slack threads',
    plane: 'lens',
    group: 'views',
  },

  'list.next': {
    combo: 'KeyJ',
    label: 'Next row',
    plane: 'pane',
    group: 'lists',
    scope: 'list',
  },
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
  'list.reply': {
    combo: 'KeyR',
    label: 'Reply',
    plane: 'pane',
    group: 'lists',
    scope: 'list',
  },
  'list.star': {
    combo: 'KeyS',
    label: 'Star or unstar',
    plane: 'pane',
    group: 'lists',
    scope: 'list',
  },
  'list.dismiss': {
    combo: 'KeyE',
    label: 'Dismiss',
    plane: 'pane',
    group: 'lists',
    scope: 'list',
  },
  'list.search': {
    combo: 'Slash',
    label: 'Search the list',
    plane: 'pane',
    group: 'lists',
    scope: 'list',
  },

  'selection.toggle': {
    combo: 'KeyX',
    label: 'Select the row under the pointer or focus',
    plane: 'pane',
    group: 'selection',
    scope: 'selection',
  },
  'selection.all': {
    combo: 'cmd+KeyA',
    label: 'Select every row',
    plane: 'app',
    group: 'selection',
    scope: 'selection',
    yieldsToText: true,
  },
  'selection.clear': {
    combo: 'Escape',
    label: 'Clear the selection',
    plane: 'pane',
    group: 'selection',
    scope: 'selection',
  },
  'selection.delete': {
    combo: 'Backspace',
    offMacCombo: 'Delete',
    label: 'Delete the selection',
    plane: 'pane',
    group: 'selection',
    scope: 'selection',
  },

  'review.next': {
    combo: 'KeyJ',
    label: 'Next comment',
    plane: 'app',
    group: 'review',
    scope: 'review',
  },
  'review.previous': {
    combo: 'KeyK',
    label: 'Previous comment',
    plane: 'app',
    group: 'review',
    scope: 'review',
  },
  'review.accept': {
    combo: 'KeyA',
    label: 'Accept',
    plane: 'app',
    group: 'review',
    scope: 'review',
  },
  'review.edit': {
    combo: 'KeyE',
    label: 'Edit or answer',
    plane: 'app',
    group: 'review',
    scope: 'review',
  },
  'review.reply': { combo: 'KeyR', label: 'Reply', plane: 'app', group: 'review', scope: 'review' },
  'review.skip': { combo: 'KeyS', label: 'Skip', plane: 'app', group: 'review', scope: 'review' },
  'review.undo': { combo: 'KeyU', label: 'Undo', plane: 'app', group: 'review', scope: 'review' },
  'review.fix': { combo: 'KeyF', label: 'Fix', plane: 'app', group: 'review', scope: 'review' },
  'review.select': {
    combo: 'KeyX',
    label: 'Select comment',
    plane: 'app',
    group: 'review',
    scope: 'review',
  },
  'review.selectAll': {
    combo: 'cmd+KeyA',
    label: 'Select every fixable comment',
    plane: 'app',
    group: 'review',
    scope: 'review',
  },

  'diff.jump': {
    combo: 'KeyT',
    label: 'Jump to a file',
    plane: 'pane',
    group: 'diff',
    scope: 'diff',
  },
  'diff.previousFile': {
    combo: 'BracketLeft',
    label: 'Previous file',
    plane: 'pane',
    group: 'diff',
    scope: 'diff',
  },
  'diff.nextFile': {
    combo: 'BracketRight',
    label: 'Next file',
    plane: 'pane',
    group: 'diff',
    scope: 'diff',
  },

  'zoom.in': { combo: 'cmd+Equal', label: 'Zoom in', plane: 'app', group: 'window' },
  'zoom.out': { combo: 'cmd+Minus', label: 'Zoom out', plane: 'app', group: 'window' },
  'zoom.reset': { combo: 'cmd+Digit0', label: 'Reset zoom', plane: 'app', group: 'window' },
} as const satisfies Record<string, ShortcutEntry>;

export type ShortcutId = keyof typeof SHORTCUTS;

export const WORKSPACE_DIGIT_IDS: ReadonlyArray<ShortcutId> = (
  Object.keys(SHORTCUTS) as ReadonlyArray<ShortcutId>
).filter((id) => (SHORTCUTS[id] as ShortcutEntry).family === 'workspace-digit');

export const SHORTCUT_FAMILY_LABEL: Readonly<Record<ShortcutFamily, string>> = {
  'workspace-digit': 'Go to workspace 1 to 9',
};

const MAC_GLYPH: Record<string, string> = {
  cmd: '⌘',
  shift: '⇧',
  alt: '⌥',
  ctrl: '⌃',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backspace: '⌫',
  Escape: '⎋',
  Enter: '↵',
  Space: '␣',
  Backquote: '`',
};

const KEY_LABEL: Record<string, string> = {
  cmd: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  ctrl: 'Ctrl',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Escape: 'Esc',
  Enter: 'Enter',
  Space: 'Space',
  Backquote: '`',
};

const codeGlyph = ({ code, glyphs }: { code: string; glyphs: Record<string, string> }): string => {
  if (glyphs[code] != null) {
    return glyphs[code];
  }
  if (code.startsWith('Key')) {
    return code.slice(3);
  }
  if (code.startsWith('Digit')) {
    return code.slice(5);
  }
  return code;
};

export const formatCombo = (combo: string): string => {
  const onMac = currentPlatform() === 'darwin';
  const glyphs = onMac ? MAC_GLYPH : KEY_LABEL;
  return combo
    .split('+')
    .map((part, index, parts) =>
      index === parts.length - 1 ? codeGlyph({ code: part, glyphs }) : (glyphs[part] ?? part),
    )
    .join(onMac ? '' : '+');
};

type EntryParams = {
  readonly entry: ShortcutEntry;
};

export const platformCombo = ({ entry }: EntryParams): string =>
  currentPlatform() === 'darwin' ? entry.combo : (entry.offMacCombo ?? entry.combo);

export const shortcutGlyphs = (id: ShortcutId): string =>
  formatCombo(platformCombo({ entry: SHORTCUTS[id] }));

type RangeParams = {
  readonly first: ShortcutId;
  readonly last: ShortcutId;
};

export const shortcutRangeGlyphs = ({ first, last }: RangeParams): string => {
  const from = shortcutGlyphs(first);
  const to = shortcutGlyphs(last);
  const shared = [...from].findIndex((char, index) => char !== to[index]);
  return shared === -1 ? from : `${from}-${to.slice(shared)}`;
};

type HintParams = {
  readonly label: string;
  readonly shortcut: ShortcutId;
};

export const withShortcutHint = ({ label, shortcut }: HintParams): string => {
  const glyphs = shortcutGlyphs(shortcut);
  return glyphs === '' ? label : `${label} (${glyphs})`;
};
