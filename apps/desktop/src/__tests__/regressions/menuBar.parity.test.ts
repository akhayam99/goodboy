// @vitest-environment happy-dom
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SHORTCUTS, type ShortcutId } from '../../shared/keyboard/registry';
import { registerShortcut } from '../../shared/keyboard/dispatcher';
import { MENU_ACTIONS } from '../../app/hooks/useMenuCommands/menuActions';
import { pressShortcut } from '../helpers/pressKey';

const MENU_SOURCE = join(__dirname, '..', '..', '..', 'src-tauri', 'src', 'app_menu.rs');

const MAC_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';

const COMMAND_ROW = /\bcommand\(\s*"([^"]+)",\s*"([^"]+)",\s*(?:Some\("([^"]+)"\)|None),?\s*\)/g;

const COMMAND_CALL = /\bcommand\(\s*"/g;

const MINOR_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
]);

const MAC_NAMES: Readonly<Record<string, string>> = {
  'app.close': 'Close',
  'column.toggle': 'Show or Hide Sidebar',
  'zoom.reset': 'Actual Size',
  'session.board': 'Sessions',
};

const OPENS_A_WINDOW: ReadonlySet<string> = new Set([
  'settings.open',
  'menu.checkForUpdates',
  'menu.newWorkspace',
]);

type MenuCommand = {
  readonly id: string;
  readonly label: string;
  readonly combo: string | null;
};

type WordParams = {
  readonly word: string;
  readonly index: number;
  readonly count: number;
};

type LabelParams = {
  readonly label: string;
};

type IdParams = {
  readonly id: string;
};

const source = readFileSync(MENU_SOURCE, 'utf8');

const menuCommands: ReadonlyArray<MenuCommand> = [...source.matchAll(COMMAND_ROW)].map(
  ([, id = '', label = '', combo]) => ({ id, label, combo: combo ?? null }),
);

const titleWord = ({ word, index, count }: WordParams): string => {
  const isEdge = index === 0 || index === count - 1;
  if (!isEdge && MINOR_WORDS.has(word.toLowerCase())) {
    return word.toLowerCase();
  }
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
};

const titleCase = ({ label }: LabelParams): string => {
  const words = label.split(' ');
  return words.map((word, index) => titleWord({ word, index, count: words.length })).join(' ');
};

const isShortcutId = (id: string): id is ShortcutId => Object.hasOwn(SHORTCUTS, id);

const isMenuActionId = (id: string): id is keyof typeof MENU_ACTIONS =>
  Object.hasOwn(MENU_ACTIONS, id);

const shortcutOf = ({ id }: IdParams): ShortcutId | null => (isShortcutId(id) ? id : null);

const sourceLabel = ({ id }: IdParams): string | null => {
  if (isShortcutId(id)) {
    return SHORTCUTS[id].label;
  }
  return isMenuActionId(id) ? MENU_ACTIONS[id].label : null;
};

const expectedLabel = ({ id }: IdParams): string | null => {
  const label = sourceLabel({ id });
  if (label === null) {
    return null;
  }
  const name = MAC_NAMES[id] ?? titleCase({ label });
  return OPENS_A_WINDOW.has(id) ? `${name}…` : name;
};

const keyedIds = (): ReadonlyArray<ShortcutId> =>
  menuCommands.flatMap(({ id }) => {
    const shortcut = shortcutOf({ id });
    return shortcut === null ? [] : [shortcut];
  });

const stops: Array<() => void> = [];

beforeAll(() => {
  Object.defineProperty(navigator, 'userAgent', { value: MAC_AGENT, configurable: true });
});

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.();
  }
  document.body.innerHTML = '';
});

describe('the macOS menu bar is a view of the shortcut registry', () => {
  it('reads every command row of app_menu.rs', () => {
    expect(menuCommands.length).toBe([...source.matchAll(COMMAND_CALL)].length);
    expect(menuCommands.length).toBeGreaterThan(20);
  });

  it('names a registry shortcut or a menu action with every item', () => {
    const orphans = menuCommands.filter(({ id }) => sourceLabel({ id }) === null);
    expect(orphans.map(({ id }) => id)).toEqual([]);
  });

  it('gives every keyed item the registry combo, and no combo to the rest', () => {
    const drift = menuCommands.filter(({ id, combo }) => {
      const shortcut = shortcutOf({ id });
      if (shortcut !== null) {
        return combo !== SHORTCUTS[shortcut].combo;
      }
      return combo !== null;
    });
    expect(drift).toEqual([]);
  });

  it('names the global owner of a key, so scoped owners keep their places', () => {
    const scoped = keyedIds().filter((id) => 'scope' in SHORTCUTS[id]);
    expect(scoped).toEqual([]);
  });

  it('labels every item with its registry name in macOS title case', () => {
    const drift = menuCommands
      .map(({ id, label }) => ({ id, label, expected: expectedLabel({ id }) }))
      .filter(({ label, expected }) => label !== expected);
    expect(drift).toEqual([]);
  });

  it('lists every menu action in the menu bar', () => {
    const ids = new Set(menuCommands.map(({ id }) => id));
    expect(Object.keys(MENU_ACTIONS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('leaves Undo and Redo to the predefined items', () => {
    const combos = menuCommands.map(({ combo }) => combo);
    expect(combos).not.toContain('cmd+KeyZ');
    expect(combos).not.toContain('cmd+shift+KeyZ');
  });
});

describe('a menu key runs once', () => {
  it('takes every keyed item in the web view and stops the native item from running too', () => {
    const missed = keyedIds().filter((id) => {
      let runs = 0;
      stops.push(
        registerShortcut(id, () => {
          runs += 1;
        }),
      );
      const event = pressShortcut({ id, target: document.body });
      return runs !== 1 || !event.defaultPrevented;
    });
    expect(missed).toEqual([]);
  });

  it('takes the undo key outside a text field and leaves it to the native Undo inside one', () => {
    let runs = 0;
    stops.push(
      registerShortcut('app.undo', () => {
        runs += 1;
      }),
    );
    const field = document.createElement('textarea');
    document.body.append(field);

    const onBody = pressShortcut({ id: 'app.undo', target: document.body });
    field.focus();
    const inField = pressShortcut({ id: 'app.undo', target: field });

    expect(runs).toBe(1);
    expect(onBody.defaultPrevented).toBe(true);
    expect(inField.defaultPrevented).toBe(false);
  });
});
