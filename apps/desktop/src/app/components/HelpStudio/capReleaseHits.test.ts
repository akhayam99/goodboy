// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RELEASE_HIT_CAP, capReleaseHits } from './capReleaseHits';
import type { HelpHit } from './searchHelp';

const releaseHits: ReadonlyArray<HelpHit> = Array.from({ length: 11 }, (_, index) => ({
  kind: 'release',
  key: `release:0.${index}.0`,
  version: `0.${index}.0`,
}));

const shortcutHit: HelpHit = {
  kind: 'shortcut',
  key: 'shortcut:palette',
  label: 'Palette',
  glyphs: '⌘K',
};

describe('capReleaseHits', () => {
  it('keeps three release hits and counts the rest', () => {
    const { shown, hiddenCount } = capReleaseHits({
      hits: [...releaseHits, shortcutHit],
      isAllShown: false,
    });

    expect(shown.filter((hit) => hit.kind === 'release')).toHaveLength(RELEASE_HIT_CAP);
    expect(shown).toContain(shortcutHit);
    expect(hiddenCount).toBe(8);
  });

  it('keeps every hit once the reader asks for all', () => {
    const { shown, hiddenCount } = capReleaseHits({ hits: releaseHits, isAllShown: true });

    expect(shown).toHaveLength(11);
    expect(hiddenCount).toBe(0);
  });
});
