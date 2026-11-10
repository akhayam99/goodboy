// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RELEASE_HIT_CAP, capReleaseHits } from './capReleaseHits';
import type { HelpHit } from './searchHelp';

const releaseHits: ReadonlyArray<HelpHit> = Array.from({ length: 11 }, (_, index) => ({
  kind: 'release',
  key: `release:0.${index}.0`,
  version: `0.${index}.0`,
}));

const guideHit: HelpHit = {
  kind: 'guide',
  key: 'guide:palette',
  hit: {
    key: 'palette',
    chapterId: 'palette',
    chapterTitle: 'Palette',
    term: null,
    excerpt: 'Open it with a shortcut.',
  },
};

describe('capReleaseHits', () => {
  it('keeps three release hits and counts the rest', () => {
    const { shown, hiddenCount } = capReleaseHits({
      hits: [...releaseHits, guideHit],
      isAllShown: false,
    });

    expect(shown.filter((hit) => hit.kind === 'release')).toHaveLength(RELEASE_HIT_CAP);
    expect(shown).toContain(guideHit);
    expect(hiddenCount).toBe(8);
  });

  it('keeps every hit once the reader asks for all', () => {
    const { shown, hiddenCount } = capReleaseHits({ hits: releaseHits, isAllShown: true });

    expect(shown).toHaveLength(11);
    expect(hiddenCount).toBe(0);
  });
});
