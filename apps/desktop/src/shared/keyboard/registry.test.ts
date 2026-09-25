import { afterEach, describe, expect, it, vi } from 'vitest';

const { platform } = vi.hoisted(() => ({ platform: { current: 'darwin' as 'darwin' | 'linux' } }));

vi.mock('../platform', () => ({ currentPlatform: () => platform.current }));

import {
  SHORTCUTS,
  formatCombo,
  shortcutGlyphs,
  shortcutRangeGlyphs,
  withShortcutHint,
} from './registry';
import type { ShortcutEntry } from './registry';

const RESERVED_COMBOS: ReadonlyArray<string> = [
  'cmd+KeyQ',
  'cmd+KeyW',
  'cmd+KeyM',
  'cmd+KeyH',
  'cmd+alt+KeyH',
  'cmd+alt+KeyD',
  'cmd+shift+KeyQ',
  'cmd+alt+shift+KeyQ',
  'cmd+shift+Slash',
  'cmd+shift+Digit3',
  'cmd+shift+Digit4',
  'cmd+shift+Digit5',
  'cmd+Space',
  'cmd+Tab',
  'cmd+shift+Tab',
  'cmd+Backquote',
  'cmd+KeyA',
  'cmd+KeyC',
  'cmd+KeyV',
  'cmd+KeyX',
  'cmd+KeyZ',
  'cmd+shift+KeyZ',
  'cmd+Backspace',
  'cmd+ArrowLeft',
  'cmd+ArrowRight',
  'cmd+ArrowUp',
  'cmd+ArrowDown',
];

const entries = Object.entries(SHORTCUTS);

afterEach(() => {
  platform.current = 'darwin';
});

describe('shortcut registry', () => {
  it('binds every combo exactly once', () => {
    const seen = new Map<string, string>();
    for (const [id, entry] of entries) {
      const clash = seen.get(entry.combo);
      expect(clash, `${id} and ${clash} both bind ${entry.combo}`).toBeUndefined();
      seen.set(entry.combo, id);
    }
  });

  it('binds every combo exactly once off macOS too, with per-OS combos resolved', () => {
    const seen = new Map<string, string>();
    for (const [id, entry] of entries) {
      const combo: string =
        'offMacCombo' in entry ? entry.offMacCombo : entry.combo.replace('cmd', 'ctrl');
      const clash = seen.get(combo);
      expect(clash, `${id} and ${clash} both bind ${combo} off macOS`).toBeUndefined();
      seen.set(combo, id);
    }
  });

  it('renders the per-OS combo where the platform has one', () => {
    platform.current = 'darwin';
    expect(shortcutGlyphs('terminal.newTab')).toBe('⌘T');

    platform.current = 'linux';
    expect(shortcutGlyphs('terminal.newTab')).toBe('Ctrl+Shift+T');
  });

  it('gives the review lens exactly one chord', () => {
    const reviewLensIds = entries
      .filter(([id, entry]) => entry.plane === 'lens' && id.startsWith('lens.'))
      .filter(([, entry]) => entry.label === 'Review')
      .map(([id]) => id);

    expect(reviewLensIds).toEqual(['lens.review']);
  });

  it('never binds a combo macOS reserves, or the text field owns', () => {
    for (const [id, entry] of entries) {
      expect(RESERVED_COMBOS, `${id} binds the reserved ${entry.combo}`).not.toContain(entry.combo);
    }
  });

  it('spells every combo with a physical code, never a character', () => {
    for (const [id, entry] of entries) {
      const key = entry.combo.split('+').at(-1) ?? '';
      expect(
        /^(Key[A-Z]|Digit[0-9]|Comma|Period|Slash|Minus|Equal|BracketLeft|BracketRight|Backspace|Escape|Enter)$/.test(
          key,
        ),
        `${id} uses ${key}, which is a character rather than a key code`,
      ).toBe(true);
    }
  });

  it('keeps every combo on the modifier plane its entry claims', () => {
    for (const [id, entry] of entries) {
      const parts = entry.combo.split('+');
      const shape = `${parts.includes('shift') ? 'shift' : ''}${parts.includes('alt') ? 'alt' : ''}`;
      const expected = { app: '', session: 'shift', lens: 'alt' }[entry.plane];
      expect(shape, `${id} is on the ${entry.plane} plane but reads ${entry.combo}`).toBe(expected);
    }
  });

  it('renders combos as macOS glyphs on darwin', () => {
    platform.current = 'darwin';

    expect(shortcutGlyphs('palette.open')).toBe('⌘K');
    expect(shortcutGlyphs('session.delete')).toBe('⌘⇧⌫');
    expect(shortcutGlyphs('lens.agents')).toBe('⌘⌥A');
    expect(shortcutGlyphs('workspace.1')).toBe('⌘1');
    expect(formatCombo('cmd+BracketLeft')).toBe('⌘[');
    expect(formatCombo('cmd+Enter')).toBe('⌘↵');
  });

  it('renders combos as named ctrl keys off darwin', () => {
    platform.current = 'linux';

    expect(shortcutGlyphs('palette.open')).toBe('Ctrl+K');
    expect(shortcutGlyphs('session.delete')).toBe('Ctrl+Shift+Backspace');
    expect(shortcutGlyphs('lens.agents')).toBe('Ctrl+Alt+A');
    expect(shortcutGlyphs('workspace.1')).toBe('Ctrl+1');
    expect(formatCombo('cmd+BracketLeft')).toBe('Ctrl+[');
    expect(formatCombo('cmd+Enter')).toBe('Ctrl+Enter');
  });

  it('never shows the command glyph off darwin', () => {
    platform.current = 'linux';

    for (const [id, entry] of entries) {
      expect(formatCombo(entry.combo), `${id} still renders a macOS glyph`).not.toMatch(
        /[⌘⌥⇧⌃⌫⎋↵␣]/,
      );
    }
  });

  it('keeps each family contiguous inside one group', () => {
    const widened: ReadonlyArray<readonly [string, ShortcutEntry]> = entries;
    const families = new Set(widened.flatMap(([, entry]) => entry.family ?? []));
    for (const family of families) {
      const indexes = widened.flatMap(([, entry], index) =>
        entry.family === family ? [index] : [],
      );
      const groups = new Set(indexes.map((index) => widened[index]?.[1].group));
      const start = indexes[0] ?? 0;
      expect(groups.size, `${family} spans more than one group`).toBe(1);
      expect(
        indexes.every((value, offset) => value === start + offset),
        `${family} is not contiguous`,
      ).toBe(true);
    }
  });

  it('spells a family range once, with the shared modifiers up front', () => {
    platform.current = 'darwin';
    expect(shortcutRangeGlyphs({ first: 'workspace.1', last: 'workspace.9' })).toBe('⌘1-9');
    expect(shortcutRangeGlyphs({ first: 'palette.open', last: 'palette.open' })).toBe('⌘K');

    platform.current = 'linux';
    expect(shortcutRangeGlyphs({ first: 'workspace.1', last: 'workspace.9' })).toBe('Ctrl+1-9');
  });

  it('hangs the chord off the control that triggers it', () => {
    platform.current = 'darwin';

    expect(withShortcutHint({ label: 'Delete session', shortcut: 'session.delete' })).toBe(
      'Delete session (⌘⇧⌫)',
    );
  });
});
