// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SHORTCUTS } from '../../shared/keyboard/registry';
import { productSources } from './scanControls';

const HAND_WRITTEN_TOOLTIP = /\b(?:tooltip|content)=\{`[^`]*(?:shortcutGlyphs|formatCombo)\(/;

const HAND_WRITTEN_CHORD = /\((?:⌘|⌃|⌥|⇧|[Ee]sc\)|[Ee]nter\)|[Rr]eturn\)|Ctrl\+|Cmd\+)/;

const MODIFIER_GLYPH = /[⌘⌃⌥⇧]/;

const GLYPH_OWNERS: ReadonlyArray<string> = [
  'apps/desktop/src/shared/keyboard/registry.ts',
  'packages/ui/src/components/Kbd.tsx',
];

const SHORTCUT_LITERAL = /\bshortcut(?:Id)?=\{?"([A-Za-z.]+)"/g;

const sources = productSources();

describe('a shortcut in a tooltip goes through the shortcut prop', () => {
  it('spots a hand-written key in a tooltip string', () => {
    expect(
      HAND_WRITTEN_TOOLTIP.test("tooltip={`Next match (${shortcutGlyphs('find.next')})`}"),
    ).toBe(true);
    expect(HAND_WRITTEN_TOOLTIP.test('shortcut="find.next"')).toBe(false);
    expect(HAND_WRITTEN_CHORD.test('Delete session (⌘⇧⌫)')).toBe(true);
    expect(HAND_WRITTEN_CHORD.test('Clear selection (Esc)')).toBe(true);
    expect(HAND_WRITTEN_CHORD.test('Send (enter)')).toBe(true);
    expect(HAND_WRITTEN_CHORD.test('Close image preview (esc)')).toBe(true);
  });

  it('writes no key into a tooltip or content string', () => {
    const offenders = sources
      .filter(({ text }) => HAND_WRITTEN_TOOLTIP.test(text))
      .map(({ path }) => path);

    expect(
      offenders,
      'Pass shortcut="<id>" to Tooltip or IconButton: the tooltip draws the label and the keys itself.',
    ).toEqual([]);
  });

  it('prints no parenthesised chord anywhere in the product', () => {
    const offenders = sources
      .filter(({ text }) => HAND_WRITTEN_CHORD.test(text))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it('draws a modifier glyph only where the registry or the key cap owns it', () => {
    const offenders = sources
      .filter(({ path, text }) => !GLYPH_OWNERS.includes(path) && MODIFIER_GLYPH.test(text))
      .map(({ path }) => path);

    expect(
      offenders,
      'Read the keys from shortcutGlyphs(<id>) so a rebinding reaches every hint.',
    ).toEqual([]);
  });

  it('names a real shortcut every time a shortcut prop is a literal', () => {
    const unknown = sources.flatMap(({ path, text }) =>
      [...text.matchAll(SHORTCUT_LITERAL)]
        .map((match) => match[1] ?? '')
        .filter((id) => !Object.hasOwn(SHORTCUTS, id))
        .map((id) => `${path}: ${id}`),
    );

    expect(unknown).toEqual([]);
  });
});
