import { describe, expect, it } from 'vitest';
import { PALETTE_PREFIXES, palettePlaceholder } from './palettePrefixes';

describe('palette prefixes', () => {
  it('offers only the prefixes the palette can actually filter by', () => {
    const symbols = PALETTE_PREFIXES.map((prefix) => prefix.symbol);

    expect(symbols).not.toContain('/');
    expect(symbols).not.toContain('~');
    expect(symbols).toEqual(['@', '#', ':', '$', '>', '?']);
  });

  it('names the same prefixes in the placeholder as in the prefix row', () => {
    const placeholder = palettePlaceholder({ prefix: null });

    expect(placeholder).toBe('Search anything, or type @ # : $ > ? to filter');
    for (const prefix of PALETTE_PREFIXES) {
      expect(placeholder, prefix.symbol).toContain(prefix.symbol);
    }
  });

  it('narrows the placeholder once a prefix is typed', () => {
    const sessions = PALETTE_PREFIXES.find((prefix) => prefix.symbol === '#');

    expect(sessions).toBeDefined();
    expect(palettePlaceholder({ prefix: sessions ?? null })).toBe('Search sessions…');
  });
});
