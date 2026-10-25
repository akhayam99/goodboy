// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { platform } = vi.hoisted(() => {
  const state: { current: 'darwin' | 'linux' } = { current: 'darwin' };
  return { platform: state };
});

vi.mock('../../platform', () => ({ currentPlatform: () => platform.current }));

import { eventMatches } from '../dispatcher';
import { SHORTCUTS, shortcutGlyphs, type ShortcutId } from '../registry';
import { comboFromEvent } from './comboFromEvent';
import { findComboConflict } from './findComboConflict';
import { isRebindable } from './isRebindable';
import { MENU_BOUND_IDS } from './menuBoundIds';
import { parseShortcutOverrides } from './parseShortcutOverrides';
import { setShortcutOverrides } from './setShortcutOverrides';

afterEach(() => {
  platform.current = 'darwin';
  setShortcutOverrides({ overrides: {} });
});

const keyEvent = (init: KeyboardEventInit): KeyboardEvent => new KeyboardEvent('keydown', init);

describe('conflict detection', () => {
  it('names the shortcut that already holds a chord in the same place', () => {
    expect(findComboConflict({ id: 'lens.plans', combo: 'cmd+alt+KeyS', overrides: {} })).toEqual({
      kind: 'clash',
      otherId: 'lens.scripts',
      label: SHORTCUTS['lens.scripts'].label,
    });
  });

  it('lets two different places share a chord and blocks the same place', () => {
    const overrides = { 'terminal.newHere': 'cmd+alt+KeyZ' };

    expect(findComboConflict({ id: 'chat.newHere', combo: 'cmd+alt+KeyZ', overrides })).toBeNull();
    expect(
      findComboConflict({ id: 'terminal.closeTab', combo: 'cmd+alt+KeyZ', overrides }),
    ).toEqual({
      kind: 'clash',
      otherId: 'terminal.newHere',
      label: SHORTCUTS['terminal.newHere'].label,
    });
  });

  it('treats a global shortcut as present in every place', () => {
    expect(
      findComboConflict({ id: 'terminal.renameTab', combo: 'cmd+alt+KeyS', overrides: {} }),
    ).toMatchObject({ kind: 'clash', otherId: 'lens.scripts' });
  });

  it('checks the chord a Linux desktop would send too', () => {
    expect(
      findComboConflict({ id: 'lens.plans', combo: 'ctrl+shift+KeyW', overrides: {} }),
    ).toMatchObject({ kind: 'clash', otherId: 'app.close' });
  });

  it('reads another row override before its default', () => {
    expect(
      findComboConflict({
        id: 'lens.plans',
        combo: 'cmd+alt+KeyS',
        overrides: { 'lens.scripts': 'cmd+alt+KeyK' },
      }),
    ).toBeNull();
    expect(
      findComboConflict({
        id: 'lens.plans',
        combo: 'cmd+alt+KeyK',
        overrides: { 'lens.scripts': 'cmd+alt+KeyK' },
      }),
    ).toMatchObject({ kind: 'clash', otherId: 'lens.scripts' });
  });

  it('compares chords whatever order the modifiers were written in', () => {
    expect(
      findComboConflict({ id: 'lens.plans', combo: 'alt+cmd+KeyS', overrides: {} }),
    ).toMatchObject({ kind: 'clash', otherId: 'lens.scripts' });
  });

  it('refuses a system chord and a key with no chord modifier', () => {
    expect(findComboConflict({ id: 'lens.plans', combo: 'cmd+KeyQ', overrides: {} })).toEqual({
      kind: 'reserved',
    });
    expect(findComboConflict({ id: 'lens.plans', combo: 'shift+KeyJ', overrides: {} })).toEqual({
      kind: 'needsModifier',
    });
    expect(findComboConflict({ id: 'lens.plans', combo: 'KeyJ', overrides: {} })).toEqual({
      kind: 'needsModifier',
    });
  });

  it('accepts a free chord', () => {
    expect(
      findComboConflict({ id: 'lens.plans', combo: 'cmd+alt+KeyJ', overrides: {} }),
    ).toBeNull();
  });
});

describe('which rows can be rebound', () => {
  it('keeps the menu bar, the composer keys, plain keys and families out', () => {
    const fixed: ReadonlyArray<ShortcutId> = [
      'palette.open',
      'composer.send',
      'composer.submit',
      'overlay.close',
      'list.star',
      'workspace.1',
      'terminal.tab1',
      'app.undo',
    ];

    expect(fixed.filter((id) => isRebindable({ id }))).toEqual([]);
  });

  it('opens the view and session chords', () => {
    const open: ReadonlyArray<ShortcutId> = [
      'lens.agents',
      'session.model',
      'terminal.newTab',
      'terminal.prevTab',
      'terminal.renameTab',
    ];

    expect(open.filter((id) => !isRebindable({ id }))).toEqual([]);
  });

  it('lists every menu bar shortcut of the native menu', () => {
    const source = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'src-tauri', 'src', 'app_menu.rs'),
      'utf8',
    );
    const inMenu = [...source.matchAll(/command\(\s*"([A-Za-z.]+)",\s*"[^"]*",\s*Some\(/g)].map(
      (match) => match[1] ?? '',
    );

    expect([...MENU_BOUND_IDS].sort()).toEqual([...inMenu].sort());
  });
});

describe('reading the saved overrides', () => {
  it('keeps only known, rebindable, well-formed chords and writes them normalised', () => {
    const raw = JSON.stringify({
      'lens.plans': 'shift+alt+cmd+KeyJ',
      'composer.send': 'cmd+KeyJ',
      'palette.open': 'cmd+KeyJ',
      'no.such.id': 'cmd+KeyJ',
      'lens.scripts': 'not a chord',
      'lens.explore': 7,
    });

    expect(parseShortcutOverrides({ raw })).toEqual({ 'lens.plans': 'cmd+alt+shift+KeyJ' });
  });

  it('falls back to no overrides on a missing or broken value', () => {
    expect(parseShortcutOverrides({ raw: undefined })).toEqual({});
    expect(parseShortcutOverrides({ raw: '{' })).toEqual({});
    expect(parseShortcutOverrides({ raw: '[1]' })).toEqual({});
    expect(parseShortcutOverrides({ raw: 'null' })).toEqual({});
  });
});

describe('the layer over the registry', () => {
  it('answers hints and key matching from the override, then from the default again', () => {
    setShortcutOverrides({ overrides: { 'lens.plans': 'cmd+alt+KeyJ' } });
    const entry = SHORTCUTS['lens.plans'];

    expect(shortcutGlyphs('lens.plans')).toBe('⌘⌥J');
    expect(
      eventMatches({ event: keyEvent({ code: 'KeyJ', metaKey: true, altKey: true }), entry }),
    ).toBe(true);
    expect(
      eventMatches({ event: keyEvent({ code: 'KeyP', metaKey: true, altKey: true }), entry }),
    ).toBe(false);

    setShortcutOverrides({ overrides: {} });
    expect(shortcutGlyphs('lens.plans')).toBe('⌘⌥P');
  });

  it('spells an override as Ctrl chords off macOS and matches it there', () => {
    platform.current = 'linux';
    setShortcutOverrides({ overrides: { 'lens.plans': 'cmd+alt+KeyJ' } });

    expect(shortcutGlyphs('lens.plans')).toBe('Ctrl+Alt+J');
    expect(
      eventMatches({
        event: keyEvent({ code: 'KeyJ', ctrlKey: true, altKey: true }),
        entry: SHORTCUTS['lens.plans'],
      }),
    ).toBe(true);
  });
});

describe('recording a chord from a key press', () => {
  it('waits on a bare modifier and builds the chord from the first real key', () => {
    expect(
      comboFromEvent({ event: keyEvent({ code: 'MetaLeft', metaKey: true }), isMac: true }),
    ).toEqual({ kind: 'waiting' });
    expect(
      comboFromEvent({
        event: keyEvent({ code: 'KeyJ', metaKey: true, altKey: true, shiftKey: true }),
        isMac: true,
      }),
    ).toEqual({ kind: 'combo', combo: 'cmd+alt+shift+KeyJ' });
  });

  it('reads Control as the command key off macOS and refuses Super', () => {
    expect(
      comboFromEvent({ event: keyEvent({ code: 'KeyJ', ctrlKey: true }), isMac: false }),
    ).toEqual({ kind: 'combo', combo: 'cmd+KeyJ' });
    expect(
      comboFromEvent({ event: keyEvent({ code: 'KeyJ', metaKey: true }), isMac: false }),
    ).toEqual({ kind: 'unsupported' });
  });

  it('keeps Control as Control on macOS and refuses a key with no code', () => {
    expect(
      comboFromEvent({ event: keyEvent({ code: 'KeyJ', ctrlKey: true }), isMac: true }),
    ).toEqual({ kind: 'combo', combo: 'ctrl+KeyJ' });
    expect(
      comboFromEvent({ event: keyEvent({ code: 'Space', ctrlKey: true }), isMac: true }),
    ).toEqual({ kind: 'unsupported' });
  });
});
